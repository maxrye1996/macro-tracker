/**
 * Day keys are `YYYY-MM-DD` in the device's *local* timezone.
 *
 * Deliberately not UTC and not `Date.toISOString()`: a user logging dinner at
 * 22:00 in London expects it on today's sheet, and a user who flies to Tokyo
 * expects the day to roll over on Tokyo's midnight. Local dates are also what
 * makes the day boundary self-correcting with no stored timezone.
 */

export type DayKey = string;

const DAY_KEY_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  // Reject calendar-impossible dates such as 2026-02-31 that pass the regex.
  return toDayKey(fromDayKey(value)) === value;
}

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear().toString().padStart(4, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local midnight of the given day key. */
export function fromDayKey(key: DayKey): Date {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  return new Date(y, m - 1, d);
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function addDays(key: DayKey, delta: number): DayKey {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

/** Milliseconds until the next local midnight, used to roll the view over. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1_000, next.getTime() - now.getTime());
}

export function formatDayLabel(key: DayKey, today: DayKey = todayKey()): string {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  const date = fromDayKey(key);
  const sameYear = date.getFullYear() === fromDayKey(today).getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
