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
import { isMacroId, normaliseAmount, normaliseTarget, type MacroId } from "./macros";
import { createId, MAX_ENTRIES_PER_DAY, type DayLog, type Entry, type Targets } from "./schema";

export const CSV_HEADER = ["type", "date", "macro", "amount", "logged_at"] as const;

/** Refuse anything implausible for a personal macro log. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 100_000;

/**
 * Spreadsheets execute a cell that starts with =, +, - or @. None of our fields
 * can currently start with those, but the guard is applied anyway so that a
 * future field (a note, a food name) cannot turn an export into a payload that
 * runs when the user opens their own backup.
 */
function escapeField(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value);
  const body = risky ? `'${value}` : value;
  return /[",\r\n]/.test(body) ? `"${body.replace(/"/g, '""')}"` : body;
}

function row(fields: readonly string[]): string {
  return fields.map(escapeField).join(",");
}

export function exportCsv(targets: Targets, days: readonly DayLog[]): string {
  const lines: string[] = [row(CSV_HEADER)];

  for (const macro of Object.keys(targets) as MacroId[]) {
    lines.push(row(["target", "", macro, String(targets[macro]), ""]));
  }

  // Oldest first, and stable within a day, so re-exporting produces an
  // identical file when nothing changed.
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of ordered) {
    const entries = [...day.entries].sort((a, b) => a.at - b.at);
    for (const entry of entries) {
      lines.push(
        row(["entry", day.date, entry.macro, String(entry.amount), new Date(entry.at).toISOString()]),
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
  readonly targets: Targets | null;
  readonly days: readonly DayLog[];
  readonly imported: number;
  readonly skipped: number;
}

export type ImportOutcome =
  | { readonly ok: true; readonly value: ImportResult }
  | { readonly ok: false; readonly error: string };

export function parseCsv(text: string): ImportOutcome {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "That file is too large to be a MacroTracro backup." };
  }

  const cleaned = text.replace(/^﻿/, "");
  const rows = parseRows(cleaned, MAX_IMPORT_ROWS + 1);
  if (rows.length === 0) return { ok: false, error: "That file is empty." };

  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const expected = CSV_HEADER.join(",");
  if (header.join(",") !== expected) {
    return { ok: false, error: "Unrecognised file. Expected a CSV exported from MacroTracro." };
  }

  const partialTargets: Partial<Record<MacroId, number>> = {};
  const byDate = new Map<DayKey, Entry[]>();
  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells || cells.length === 0) continue;
    // Undo the anti-injection prefix added on export.
    const [type = "", date = "", macroRaw = "", amountRaw = "", atRaw = ""] = cells.map((c) =>
      c.trim().replace(/^'(?=[=+\-@])/, ""),
    );

    const macro = macroRaw.toLowerCase();
    if (!isMacroId(macro)) {
      skipped += 1;
      continue;
    }

    if (type === "target") {
      const value = normaliseTarget(amountRaw, macro);
      if (value === null) skipped += 1;
      else partialTargets[macro] = value;
      continue;
    }

    if (type !== "entry" || !isDayKey(date)) {
      skipped += 1;
      continue;
    }

    const amount = normaliseAmount(amountRaw, macro);
    if (amount === null) {
      skipped += 1;
      continue;
    }

    const bucket = byDate.get(date) ?? [];
    if (bucket.length >= MAX_ENTRIES_PER_DAY) {
      skipped += 1;
      continue;
    }

    const parsedAt = Date.parse(atRaw);
    const at = Number.isFinite(parsedAt) ? parsedAt : new Date(`${date}T12:00:00`).getTime();
    bucket.push({ id: createId(), macro, amount, at });
    byDate.set(date, bucket);
    imported += 1;
  }

  const targets =
    partialTargets.calories !== undefined &&
    partialTargets.protein !== undefined &&
    partialTargets.fibre !== undefined
      ? (partialTargets as Targets)
      : null;

  if (targets === null && imported === 0) {
    return { ok: false, error: "No usable targets or entries found in that file." };
  }

  const days: DayLog[] = [...byDate.entries()]
    .map(([date, entries]) => ({ date, entries: entries.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { ok: true, value: { targets, days, imported, skipped } };
}

export function csvFilename(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `macrotracro-${stamp}.csv`;
}
