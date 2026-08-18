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

export const SCHEMA_VERSION = 2;

/** Guards against a single pathological day blowing up render and storage. */
export const MAX_ENTRIES_PER_DAY = 500;

export interface Entry {
  readonly id: string;
  readonly trackerId: string;
  readonly amount: number;
  /** Epoch ms the entry was logged. Display only; the day key is authoritative. */
  readonly at: number;
}

export interface DayLog {
  readonly date: DayKey;
  readonly entries: readonly Entry[];
}

export interface Settings {
  readonly trackers: readonly Tracker[];
  readonly createdAt: number;
}

/** Narrow unknown JSON to a plain object without inheriting anything from it. */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

function asEpoch(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // Reject timestamps outside a plausible range so a corrupt value cannot
  // produce an "Invalid Date" in the UI.
  if (value < 0 || value > 4_102_444_800_000 /* year 2100 */) return null;
  return Math.floor(value);
}

export function parseTracker(value: unknown): Tracker | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = asId(raw["id"]);
  if (id === null) return null;

  const name = sanitiseName(raw["name"]);
  if (name === "") return null;

  const target = normaliseAmount(raw["target"]);
  if (target === null) return null;

  return {
    id,
    name,
    unit: sanitiseUnit(raw["unit"]),
    target,
    colour: isColourId(raw["colour"]) ? raw["colour"] : DEFAULT_COLOUR,
    // Absent on data written before goals existed — defaults to a limit, so an
    // old install keeps behaving exactly as it did.
    direction: isDirection(raw["direction"]) ? raw["direction"] : DEFAULT_DIRECTION,
    archived: raw["archived"] === true,
  };
}

export function parseTrackers(value: unknown): Tracker[] | null {
  if (!Array.isArray(value)) return null;
  const out: Tracker[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (out.length >= MAX_TRACKERS) break;
    const tracker = parseTracker(item);
    // A single unreadable tracker is dropped rather than losing the whole set.
    if (!tracker || seen.has(tracker.id)) continue;
    seen.add(tracker.id);
    out.push(tracker);
  }
  return out;
}

export function parseSettings(value: unknown): Settings | null {
  const raw = asRecord(value);
  if (!raw || raw["v"] !== SCHEMA_VERSION) return null;
  const trackers = parseTrackers(raw["trackers"]);
  if (!trackers) return null;
  return { trackers, createdAt: asEpoch(raw["createdAt"]) ?? Date.now() };
}

export function serialiseSettings(settings: Settings): unknown {
  return {
    v: SCHEMA_VERSION,
    createdAt: settings.createdAt,
    trackers: settings.trackers.map((t) => ({
      id: t.id,
      name: t.name,
      unit: t.unit,
      target: t.target,
      colour: t.colour,
      direction: t.direction,
      archived: t.archived,
    })),
  };
}

function parseEntry(value: unknown, fallbackAt: number): Entry | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const trackerId = asId(raw["trackerId"]);
  if (trackerId === null) return null;
  const amount = normaliseAmount(raw["amount"]);
  if (amount === null) return null;
  const id = asId(raw["id"]) ?? createId();
  return { id, trackerId, amount, at: asEpoch(raw["at"]) ?? fallbackAt };
}

export function parseDayLog(value: unknown, expectedDate: DayKey): DayLog | null {
  const raw = asRecord(value);
  if (!raw || raw["v"] !== SCHEMA_VERSION) return null;
  if (raw["date"] !== expectedDate) return null;
  const rawEntries = raw["entries"];
  if (!Array.isArray(rawEntries)) return null;

  const fallbackAt = middayOn(expectedDate);
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
    entries: day.entries.map((e) => ({
      id: e.id,
      trackerId: e.trackerId,
      amount: e.amount,
      at: e.at,
    })),
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

/** Ids only need to be locally unique; they are never sent anywhere. */
export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A neutral time-of-day for entries that arrive without a usable timestamp. */
export function middayOn(date: DayKey): number {
  return new Date(`${date}T12:00:00`).getTime();
}

export function emptyDay(date: DayKey): DayLog {
  return { date, entries: [] };
}

/**
 * Totals keyed by tracker id. A Map rather than an object because the keys are
 * arbitrary strings and a Map has no prototype to collide with.
 */
export function totalsFor(day: DayLog): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of day.entries) {
    totals.set(entry.trackerId, (totals.get(entry.trackerId) ?? 0) + entry.amount);
  }
  // Sum in float then round once, so 0.1 + 0.2 never surfaces as 0.30000000000000004.
  for (const [id, value] of totals) totals.set(id, Math.round(value * 10) / 10);
  return totals;
}
