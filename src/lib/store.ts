/**
 * Single external store behind `useSyncExternalStore`.
 *
 * Rendering never reads localStorage directly. The store hydrates once after
 * mount (the server-rendered snapshot is deliberately empty, so the static
 * export and the first client render always agree) and thereafter serves an
 * immutable snapshot that only changes when data actually changes.
 *
 * Days are cached in memory and read lazily, so stepping back through history
 * costs one small parse per day visited, and adding an entry writes exactly one
 * key regardless of how much history exists.
 */

import { exportCsv, parseCsv, type ImportOutcome } from "./csv";
import { addDays, todayKey, type DayKey } from "./date";
import type { MacroId } from "./macros";
import { normaliseAmount } from "./macros";
import {
  createId,
  emptyDay,
  MAX_ENTRIES_PER_DAY,
  parseDayLog,
  parseIndex,
  parseSettings,
  serialiseDayLog,
  serialiseIndex,
  serialiseSettings,
  type DayLog,
  type Entry,
  type Settings,
  type Targets,
} from "./schema";
import {
  clearAll,
  isDayStorageKey,
  KEYS,
  ownedKeys,
  readJson,
  storageAvailable,
  writeJson,
} from "./storage";

export interface AppState {
  /** False until the first client-side read completes. */
  readonly hydrated: boolean;
  /** False when the browser denies persistence (private mode, disabled storage). */
  readonly storageOk: boolean;
  /** True once a write has failed — usually quota. Surfaced to the user. */
  readonly writeFailed: boolean;
  readonly settings: Settings | null;
  readonly today: DayKey;
  readonly viewDate: DayKey;
  readonly day: DayLog;
  readonly loggedDays: readonly DayKey[];
}

const INITIAL: AppState = Object.freeze({
  hydrated: false,
  storageOk: true,
  writeFailed: false,
  settings: null,
  today: "1970-01-01",
  viewDate: "1970-01-01",
  day: emptyDay("1970-01-01"),
  loggedDays: [] as readonly DayKey[],
});

let state: AppState = INITIAL;
const listeners = new Set<() => void>();

/** Bounded memory cache of parsed days; history browsing stays cheap. */
const DAY_CACHE_LIMIT = 32;
const dayCache = new Map<DayKey, DayLog>();

function cacheDay(day: DayLog): DayLog {
  dayCache.delete(day.date);
  dayCache.set(day.date, day);
  if (dayCache.size > DAY_CACHE_LIMIT) {
    const oldest = dayCache.keys().next();
    if (!oldest.done) dayCache.delete(oldest.value);
  }
  return day;
}

function loadDay(date: DayKey): DayLog {
  const cached = dayCache.get(date);
  if (cached) return cached;
  const parsed = parseDayLog(readJson(KEYS.day(date)), date) ?? emptyDay(date);
  return cacheDay(parsed);
}

function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AppState {
  return state;
}

export function getServerSnapshot(): AppState {
  return INITIAL;
}

let hydrating = false;

export function hydrate(): void {
  if (state.hydrated || hydrating) return;
  hydrating = true;

  const storageOk = storageAvailable();
  const settings = storageOk ? parseSettings(readJson(KEYS.settings)) : null;
  const loggedDays = (storageOk ? parseIndex(readJson(KEYS.index)) : null) ?? recoverIndex();
  const today = todayKey();

  state = {
    hydrated: true,
    storageOk,
    writeFailed: false,
    settings,
    today,
    viewDate: today,
    day: storageOk ? loadDay(today) : emptyDay(today),
    loggedDays,
  };
  hydrating = false;
  for (const listener of listeners) listener();
}

/**
 * If the index key is missing or corrupt, rebuild it by scanning our own keys.
 * Cheap (localStorage enumeration only) and means a lost index never hides a
 * user's history.
 */
function recoverIndex(): DayKey[] {
  const days = ownedKeys()
    .filter(isDayStorageKey)
    .map((key) => key.slice(key.lastIndexOf(".") + 1))
    .sort();
  if (days.length > 0) writeJson(KEYS.index, serialiseIndex(days));
  return days;
}

function persistDay(day: DayLog): boolean {
  cacheDay(day);
  return writeJson(KEYS.day(day.date), serialiseDayLog(day));
}

function withDayInIndex(date: DayKey): readonly DayKey[] {
  if (state.loggedDays.includes(date)) return state.loggedDays;
  const next = [...state.loggedDays, date].sort();
  writeJson(KEYS.index, serialiseIndex(next));
  return next;
}

// ---------------------------------------------------------------- actions ---

export function setTargets(targets: Targets): void {
  const settings: Settings = { targets, createdAt: state.settings?.createdAt ?? Date.now() };
  const ok = writeJson(KEYS.settings, serialiseSettings(settings));
  setState({ settings, writeFailed: state.writeFailed || !ok });
}

export type AddResult = "added" | "invalid" | "day-full";

export function addEntry(macro: MacroId, rawAmount: unknown): AddResult {
  const amount = normaliseAmount(rawAmount, macro);
  if (amount === null) return "invalid";

  const current = state.day;
  if (current.entries.length >= MAX_ENTRIES_PER_DAY) return "day-full";

  const entry: Entry = { id: createId(), macro, amount, at: Date.now() };
  const day: DayLog = { date: current.date, entries: [...current.entries, entry] };
  const ok = persistDay(day);
  setState({
    day,
    loggedDays: withDayInIndex(day.date),
    writeFailed: state.writeFailed || !ok,
  });
  return "added";
}

export function removeEntry(id: string): void {
  const current = state.day;
  const entries = current.entries.filter((e) => e.id !== id);
  if (entries.length === current.entries.length) return;

  const day: DayLog = { date: current.date, entries };
  const ok = persistDay(day);
  setState({ day, writeFailed: state.writeFailed || !ok });
}

export function goToDate(date: DayKey): void {
  if (date === state.viewDate) return;
  // Never allow logging into the future; there is nothing to record there.
  const clamped = date > state.today ? state.today : date;
  setState({ viewDate: clamped, day: loadDay(clamped) });
}

export function shiftDay(delta: number): void {
  goToDate(addDays(state.viewDate, delta));
}

/** Called by the midnight timer and on app resume, so a day never goes stale. */
export function refreshToday(): void {
  const today = todayKey();
  if (today === state.today) return;
  const followToday = state.viewDate === state.today;
  const viewDate = followToday ? today : state.viewDate;
  setState({ today, viewDate, day: loadDay(viewDate) });
}

/** Re-read from disk after another tab wrote. */
export function reloadFromStorage(): void {
  if (!state.hydrated) return;
  dayCache.clear();
  const settings = parseSettings(readJson(KEYS.settings));
  const loggedDays = parseIndex(readJson(KEYS.index)) ?? recoverIndex();
  setState({ settings, loggedDays, day: loadDay(state.viewDate) });
}

export function buildExport(): string {
  const targets = state.settings?.targets;
  if (!targets) return "";
  const days = state.loggedDays.map(loadDay).filter((day) => day.entries.length > 0);
  return exportCsv(targets, days);
}

export interface ImportSummary {
  readonly days: number;
  readonly entries: number;
  readonly skipped: number;
  readonly targetsApplied: boolean;
}

export type ImportReport =
  | { readonly ok: true; readonly summary: ImportSummary }
  | { readonly ok: false; readonly error: string };

/**
 * Replaces all local data with the file's contents. Replace rather than merge
 * is the honest behaviour for a "restore my backup" button: merging would
 * silently double every entry if a file is imported twice.
 */
export function importFromCsv(text: string): ImportReport {
  const outcome: ImportOutcome = parseCsv(text);
  if (!outcome.ok) return { ok: false, error: outcome.error };

  const { targets, days, imported, skipped } = outcome.value;

  clearAll();
  dayCache.clear();

  let writeFailed = false;
  const dayKeys: DayKey[] = [];
  for (const day of days) {
    if (day.entries.length === 0) continue;
    if (!persistDay(day)) writeFailed = true;
    dayKeys.push(day.date);
  }
  if (!writeJson(KEYS.index, serialiseIndex(dayKeys))) writeFailed = true;

  const settings: Settings | null = targets
    ? { targets, createdAt: state.settings?.createdAt ?? Date.now() }
    : state.settings;
  if (settings && !writeJson(KEYS.settings, serialiseSettings(settings))) writeFailed = true;

  const today = todayKey();
  setState({
    settings,
    today,
    viewDate: today,
    day: loadDay(today),
    loggedDays: dayKeys,
    writeFailed,
  });

  return {
    ok: true,
    summary: {
      days: dayKeys.length,
      entries: imported,
      skipped,
      targetsApplied: targets !== null,
    },
  };
}

/** Wipes every key this app owns and returns to first-run. */
export function deleteEverything(): void {
  clearAll();
  dayCache.clear();
  const today = todayKey();
  setState({
    settings: null,
    today,
    viewDate: today,
    day: emptyDay(today),
    loggedDays: [],
    writeFailed: false,
  });
}
