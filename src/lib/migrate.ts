/**
 * One-shot upgrade from the original fixed calories/protein/fibre schema to
 * user-defined trackers.
 *
 * The three old macros become three ordinary trackers whose ids are their old
 * names, so every logged entry maps across without being rewritten field by
 * field. Legacy keys are only removed once the new ones have been written
 * successfully — a migration that fails half way leaves the old data intact
 * and simply runs again next launch.
 */

import { isDayKey, type DayKey } from "./date";
import {
  createId,
  serialiseDayLog,
  serialiseIndex,
  serialiseSettings,
  type DayLog,
  type Entry,
  type Settings,
} from "./schema";
import {
  clearLegacy,
  LEGACY_KEYS,
  ownedKeys,
  readJson,
  writeJson,
  KEYS,
} from "./storage";
import { normaliseAmount, type ColourId, type Tracker } from "./trackers";

const LEGACY_MACROS: readonly { id: string; name: string; unit: string; colour: ColourId }[] = [
  { id: "calories", name: "Calories", unit: "kcal", colour: "amber" },
  { id: "protein", name: "Protein", unit: "g", colour: "blue" },
  { id: "fibre", name: "Fibre", unit: "g", colour: "green" },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function legacyTrackers(targets: Record<string, unknown>): Tracker[] {
  const trackers: Tracker[] = [];
  for (const macro of LEGACY_MACROS) {
    const target = normaliseAmount(targets[macro.id]);
    if (target === null) continue;
    trackers.push({
      id: macro.id,
      name: macro.name,
      unit: macro.unit,
      target,
      colour: macro.colour,
      archived: false,
    });
  }
  return trackers;
}

function legacyDayKeys(): DayKey[] {
  const index = asRecord(readJson(LEGACY_KEYS.index));
  const listed = Array.isArray(index?.["days"]) ? (index["days"] as unknown[]) : [];
  const keys = new Set<DayKey>();
  for (const day of listed) if (isDayKey(day)) keys.add(day);

  // Also sweep the raw keys, in case the old index was lost or truncated.
  const dayPrefix = `${LEGACY_KEYS.prefix}day.`;
  for (const key of ownedKeys()) {
    if (!key.startsWith(dayPrefix)) continue;
    const date = key.slice(dayPrefix.length);
    if (isDayKey(date)) keys.add(date);
  }
  return [...keys].sort();
}

function legacyEntries(value: unknown, date: DayKey): Entry[] {
  const raw = asRecord(value);
  if (!raw || !Array.isArray(raw["entries"])) return [];

  const known = new Set(LEGACY_MACROS.map((m) => m.id));
  const entries: Entry[] = [];
  for (const item of raw["entries"] as unknown[]) {
    const entry = asRecord(item);
    if (!entry) continue;
    const macro = entry["macro"];
    if (typeof macro !== "string" || !known.has(macro)) continue;
    const amount = normaliseAmount(entry["amount"]);
    if (amount === null) continue;
    const at = typeof entry["at"] === "number" && Number.isFinite(entry["at"]) ? entry["at"] : null;
    entries.push({
      id: typeof entry["id"] === "string" && entry["id"] ? entry["id"] : createId(),
      trackerId: macro,
      amount,
      at: at ?? new Date(`${date}T12:00:00`).getTime(),
    });
  }
  return entries;
}

export interface MigrationResult {
  readonly settings: Settings;
  readonly days: DayKey[];
}

/** Returns null when there is nothing from the old schema to bring across. */
export function migrateLegacy(): MigrationResult | null {
  const rawSettings = asRecord(readJson(LEGACY_KEYS.settings));
  if (!rawSettings) return null;

  const targets = asRecord(rawSettings["targets"]);
  const trackers = targets ? legacyTrackers(targets) : [];
  if (trackers.length === 0) {
    // Nothing usable in the old settings; drop them so this does not re-run.
    clearLegacy();
    return null;
  }

  const createdAt =
    typeof rawSettings["createdAt"] === "number" && Number.isFinite(rawSettings["createdAt"])
      ? rawSettings["createdAt"]
      : Date.now();

  const migrated: DayKey[] = [];
  let ok = true;

  for (const date of legacyDayKeys()) {
    const entries = legacyEntries(readJson(LEGACY_KEYS.day(date)), date);
    if (entries.length === 0) continue;
    const day: DayLog = { date, entries };
    if (writeJson(KEYS.day(date), serialiseDayLog(day))) migrated.push(date);
    else ok = false;
  }

  const settings: Settings = { trackers, createdAt };
  if (!writeJson(KEYS.settings, serialiseSettings(settings))) ok = false;
  if (!writeJson(KEYS.index, serialiseIndex(migrated))) ok = false;

  // Only let go of the old data once the new copy is definitely on disk.
  if (ok) clearLegacy();

  return { settings, days: migrated };
}
