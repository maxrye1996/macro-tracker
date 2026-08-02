/**
 * Shapes persisted to disk, plus the parsers that guard every read.
 *
 * These parsers are the trust boundary. Data in localStorage can be edited by
 * hand, corrupted by a half-finished write, or written by an older/newer build
 * of the app, so anything coming back out is treated as hostile input: parsed
 * field by field, never spread or `Object.assign`-ed into app state (which is
 * also what keeps a `__proto__` key in the JSON from reaching a prototype).
 */

import { isDayKey, type DayKey } from "./date";
import { MACRO_IDS, isMacroId, normaliseAmount, normaliseTarget, type MacroId } from "./macros";

export const SCHEMA_VERSION = 1;

/** Guards against a single pathological day blowing up render and storage. */
export const MAX_ENTRIES_PER_DAY = 500;

export type Targets = Readonly<Record<MacroId, number>>;

export interface Entry {
  readonly id: string;
  readonly macro: MacroId;
  readonly amount: number;
  /** Epoch ms the entry was logged. Display only; the day key is authoritative. */
  readonly at: number;
}

export interface DayLog {
  readonly date: DayKey;
  readonly entries: readonly Entry[];
}

export interface Settings {
  readonly targets: Targets;
  readonly createdAt: number;
}

/** Narrow unknown JSON to a plain object without inheriting anything from it. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asEpoch(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Reject timestamps outside a plausible range so a corrupt value cannot
  // produce an "Invalid Date" in the UI.
  if (value < 0 || value > 4_102_444_800_000 /* year 2100 */) return null;
  return Math.floor(value);
}

export function parseTargets(value: unknown): Targets | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const out: Partial<Record<MacroId, number>> = {};
  for (const id of MACRO_IDS) {
    const n = normaliseTarget(raw[id], id);
    if (n === null) return null;
    out[id] = n;
  }
  return out as Targets;
}

export function parseSettings(value: unknown): Settings | null {
  const raw = asRecord(value);
  if (!raw || raw["v"] !== SCHEMA_VERSION) return null;
  const targets = parseTargets(raw["targets"]);
  if (!targets) return null;
  return { targets, createdAt: asEpoch(raw["createdAt"]) ?? Date.now() };
}

export function serialiseSettings(settings: Settings): unknown {
  return { v: SCHEMA_VERSION, targets: { ...settings.targets }, createdAt: settings.createdAt };
}

function parseEntry(value: unknown, fallbackAt: number): Entry | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const macro = raw["macro"];
  if (!isMacroId(macro)) return null;
  const amount = normaliseAmount(raw["amount"], macro);
  if (amount === null) return null;
  const id = typeof raw["id"] === "string" && raw["id"].length > 0 && raw["id"].length <= 64
    ? raw["id"]
    : createId();
  return { id, macro, amount, at: asEpoch(raw["at"]) ?? fallbackAt };
}

export function parseDayLog(value: unknown, expectedDate: DayKey): DayLog | null {
  const raw = asRecord(value);
  if (!raw || raw["v"] !== SCHEMA_VERSION) return null;
  if (raw["date"] !== expectedDate) return null;
  const rawEntries = raw["entries"];
  if (!Array.isArray(rawEntries)) return null;

  const fallbackAt = new Date(`${expectedDate}T12:00:00`).getTime();
  const entries: Entry[] = [];
  const seen = new Set<string>();
  for (const item of rawEntries.slice(0, MAX_ENTRIES_PER_DAY)) {
    const entry = parseEntry(item, fallbackAt);
    // Drop unreadable rows rather than failing the whole day: losing one bad
    // entry is far better than showing an empty day for a corrupt byte.
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return { date: expectedDate, entries };
}

export function serialiseDayLog(day: DayLog): unknown {
  return {
    v: SCHEMA_VERSION,
    date: day.date,
    entries: day.entries.map((e) => ({ id: e.id, macro: e.macro, amount: e.amount, at: e.at })),
  };
}

export function parseIndex(value: unknown): DayKey[] | null {
  const raw = asRecord(value);
  if (!raw || raw["v"] !== SCHEMA_VERSION) return null;
  const days = raw["days"];
  if (!Array.isArray(days)) return null;
  const unique = new Set<DayKey>();
  for (const day of days) if (isDayKey(day)) unique.add(day);
  return [...unique].sort();
}

export function serialiseIndex(days: readonly DayKey[]): unknown {
  return { v: SCHEMA_VERSION, days: [...days] };
}

/** Entry ids only need to be locally unique; they are never sent anywhere. */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDay(date: DayKey): DayLog {
  return { date, entries: [] };
}

export function totalsFor(day: DayLog): Record<MacroId, number> {
  const totals: Record<MacroId, number> = { calories: 0, protein: 0, fibre: 0 };
  for (const entry of day.entries) totals[entry.macro] += entry.amount;
  // Sum in float then round once, so 0.1 + 0.2 never surfaces as 0.30000000000000004.
  for (const id of MACRO_IDS) totals[id] = Math.round(totals[id] * 10) / 10;
  return totals;
}
