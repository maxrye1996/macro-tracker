/**
 * CSV is the backup/transfer format: readable in any spreadsheet, diffable, and
 * not tied to this app's internal shape. It is only ever produced and consumed
 * on the device — nothing here uploads anything.
 *
 * Import treats the file as untrusted: size- and row-bounded, every field
 * re-validated through the same parsers as stored data, and unreadable rows
 * skipped and counted rather than aborting the whole import.
 */

import { isDayKey, type DayKey } from "./date";
import { createId, MAX_ENTRIES_PER_DAY, type DayLog, type Entry } from "./schema";
import { middayOn } from "./schema";
import {
  DEFAULT_COLOUR,
  DEFAULT_DIRECTION,
  isColourId,
  isDirection,
  MAX_TRACKERS,
  normaliseAmount,
  sanitiseName,
  sanitiseUnit,
  type Tracker,
} from "./trackers";

export const CSV_HEADER = [
  "type",
  "date",
  "tracker_id",
  "name",
  "unit",
  "amount",
  "logged_at",
  "colour",
  "archived",
  "direction",
] as const;

/**
 * Headers written by earlier versions, still accepted on import so a backup
 * taken before a column existed restores cleanly. Missing columns fall back to
 * their defaults (a `direction`-less file imports as all limits).
 */
const LEGACY_HEADERS: readonly string[] = [
  // Pre-0.0.6: no `direction` column.
  ["type", "date", "tracker_id", "name", "unit", "amount", "logged_at", "colour", "archived"].join(
    ",",
  ),
];

/** Refuse anything implausible for a personal log. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 100_000;

/**
 * Spreadsheets execute a cell that starts with =, +, - or @. Tracker names are
 * free text typed by the user, so a name like "=cmd|..." would otherwise turn
 * their own backup into a payload that runs when they open it.
 */
function escapeField(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value);
  const body = risky ? `'${value}` : value;
  return /[",\r\n]/.test(body) ? `"${body.replace(/"/g, '""')}"` : body;
}

function row(fields: readonly string[]): string {
  return fields.map(escapeField).join(",");
}

export function exportCsv(trackers: readonly Tracker[], days: readonly DayLog[]): string {
  const lines: string[] = [row(CSV_HEADER)];

  for (const t of trackers) {
    lines.push(
      row([
        "tracker",
        "",
        t.id,
        t.name,
        t.unit,
        String(t.target),
        "",
        t.colour,
        t.archived ? "true" : "false",
        t.direction,
      ]),
    );
  }

  const byId = new Map(trackers.map((t) => [t.id, t]));

  // Oldest first, and stable within a day, so re-exporting produces an
  // identical file when nothing changed.
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of ordered) {
    const entries = [...day.entries].sort((a, b) => a.at - b.at);
    for (const entry of entries) {
      const tracker = byId.get(entry.trackerId);
      lines.push(
        row([
          "entry",
          day.date,
          entry.trackerId,
          tracker?.name ?? "",
          tracker?.unit ?? "",
          String(entry.amount),
          new Date(entry.at).toISOString(),
          "",
          "",
          "",
        ]),
      );
    }
  }

  return `${lines.join("\r\n")}\r\n`;
}

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, CRLF or LF. */
function parseRows(text: string, maxRows: number): string[][] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    if (record.length > 1 || record[0] !== "") rows.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRecord();
      if (rows.length >= maxRows) return rows;
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) pushRecord();
  return rows;
}

export interface ImportResult {
  readonly trackers: readonly Tracker[];
  readonly days: readonly DayLog[];
  readonly imported: number;
  readonly skipped: number;
}

export type ImportOutcome =
  | { readonly ok: true; readonly value: ImportResult }
  | { readonly ok: false; readonly error: string };

/** Undo the anti-injection prefix added on export. */
function clean(cell: string | undefined): string {
  return (cell ?? "").trim().replace(/^'(?=[=+\-@])/, "");
}

function collectDays(
  entries: readonly { date: DayKey; entry: Entry }[],
): { days: DayLog[]; skipped: number } {
  const byDate = new Map<DayKey, Entry[]>();
  let skipped = 0;
  for (const { date, entry } of entries) {
    const bucket = byDate.get(date) ?? [];
    if (bucket.length >= MAX_ENTRIES_PER_DAY) {
      skipped += 1;
      continue;
    }
    bucket.push(entry);
    byDate.set(date, bucket);
  }
  const days = [...byDate.entries()]
    .map(([date, list]) => ({ date, entries: list.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { days, skipped };
}

export function parseCsv(text: string): ImportOutcome {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "That file is too large to be a TrackRyte backup." };
  }

  const cleaned = text.replace(/^﻿/, "");
  const rows = parseRows(cleaned, MAX_IMPORT_ROWS + 1);
  if (rows.length === 0) return { ok: false, error: "That file is empty." };

  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase()).join(",");
  if (header !== CSV_HEADER.join(",") && !LEGACY_HEADERS.includes(header)) {
    return { ok: false, error: "Unrecognised file. Expected a CSV exported from TrackRyte." };
  }

  const trackers: Tracker[] = [];
  const byId = new Map<string, Tracker>();
  const byName = new Map<string, Tracker>();
  let skipped = 0;

  // First pass: tracker definitions, so entry rows can reference them
  // regardless of where they appear in a hand-edited file.
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells || clean(cells[0]) !== "tracker") continue;
    if (trackers.length >= MAX_TRACKERS) {
      skipped += 1;
      continue;
    }

    const id = clean(cells[2]) || createId();
    const name = sanitiseName(clean(cells[3]));
    const target = normaliseAmount(clean(cells[5]));
    if (name === "" || target === null || byId.has(id)) {
      skipped += 1;
      continue;
    }

    const colourCell = clean(cells[7]);
    const directionCell = clean(cells[9]).toLowerCase();
    const tracker: Tracker = {
      id,
      name,
      unit: sanitiseUnit(clean(cells[4])),
      target,
      colour: isColourId(colourCell) ? colourCell : DEFAULT_COLOUR,
      // Absent in pre-0.0.6 backups; an unknown value falls back to a limit.
      direction: isDirection(directionCell) ? directionCell : DEFAULT_DIRECTION,
      archived: clean(cells[8]).toLowerCase() === "true",
    };
    trackers.push(tracker);
    byId.set(id, tracker);
    if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), tracker);
  }

  // Second pass: entries.
  const staged: { date: DayKey; entry: Entry }[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells) continue;
    const type = clean(cells[0]);
    if (type === "tracker") continue;
    if (type !== "entry") {
      skipped += 1;
      continue;
    }

    const date = clean(cells[1]);
    const amount = normaliseAmount(clean(cells[5]));
    if (!isDayKey(date) || amount === null) {
      skipped += 1;
      continue;
    }

    // Match on id, then fall back to name so a hand-edited file still works.
    const tracker =
      byId.get(clean(cells[2])) ?? byName.get(sanitiseName(clean(cells[3])).toLowerCase());
    if (!tracker) {
      skipped += 1;
      continue;
    }

    const parsedAt = Date.parse(clean(cells[6]));
    staged.push({
      date,
      entry: {
        id: createId(),
        trackerId: tracker.id,
        amount,
        at: Number.isFinite(parsedAt) ? parsedAt : middayOn(date),
      },
    });
  }

  const { days, skipped: overflow } = collectDays(staged);
  const imported = staged.length - overflow;

  if (trackers.length === 0 && imported === 0) {
    return { ok: false, error: "No usable trackers or entries found in that file." };
  }

  return { ok: true, value: { trackers, days, imported, skipped: skipped + overflow } };
}

export function csvFilename(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `trackryte-${stamp}.csv`;
}
