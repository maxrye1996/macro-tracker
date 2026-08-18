/**
 * A tracker is any daily quantity the user cares about — calories, water,
 * salt, a medication dose, steps. The app has no opinion about which ones
 * exist or what the targets should be; it only enforces that a value is a
 * sane, storable number.
 *
 * Names and units are free text typed by the user, so everything here treats
 * them as untrusted input: control characters stripped, length capped, and
 * re-validated on the way out of storage as well as on the way in.
 */

export const NAME_MAX = 24;
export const UNIT_MAX = 8;

/** One ceiling for everything: covers kcal, ml, mg, steps. */
export const VALUE_MAX = 1_000_000;

/** Bounds the horizontal rail, storage size, and per-render work. */
export const MAX_TRACKERS = 20;

export const COLOUR_IDS = [
  "amber",
  "blue",
  "green",
  "violet",
  "rose",
  "cyan",
  "lime",
  "slate",
] as const;

export type ColourId = (typeof COLOUR_IDS)[number];

export const DEFAULT_COLOUR: ColourId = "blue";

export function isColourId(value: unknown): value is ColourId {
  return typeof value === "string" && (COLOUR_IDS as readonly string[]).includes(value);
}

/** Maps to the custom properties declared in globals.css. */
export function colourVar(colour: ColourId): string {
  return `var(--c-${colour})`;
}

/**
 * What the target *means*.
 *
 * - `limit`: stay at or under it (calories, sugar, caffeine). Going over is a
 *   warning.
 * - `goal`: reach at least it (water, protein, a daily creatine dose, dog
 *   walks). Meeting or beating it is the win.
 *
 * Anything without an explicit direction — every tracker from before this
 * existed, and every older backup — is treated as a `limit`, so no stored data
 * changes meaning. `DEFAULT_DIRECTION` is the single source of that default.
 */
export type TrackerDirection = "limit" | "goal";

export const DEFAULT_DIRECTION: TrackerDirection = "limit";

export function isDirection(value: unknown): value is TrackerDirection {
  return value === "limit" || value === "goal";
}

export interface Tracker {
  readonly id: string;
  readonly name: string;
  /** May be empty — "Steps" needs no unit. */
  readonly unit: string;
  readonly target: number;
  readonly colour: ColourId;
  readonly direction: TrackerDirection;
  /**
   * Archived trackers disappear from the daily view but keep every entry ever
   * logged against them, and still appear in exports.
   */
  readonly archived: boolean;
}

/** True when a goal tracker has reached (or beaten) its target. */
export function isGoalMet(tracker: Tracker, value: number): boolean {
  return tracker.direction === "goal" && value >= tracker.target;
}

/**
 * Strips control characters (including the bidi overrides that can make a
 * name render as something other than what is stored), collapses runs of
 * whitespace, and caps the length.
 */
export function sanitiseText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return (
    value
      // Line breaks and tabs are word separators, so they become a space
      // rather than being deleted: a pasted "Vitamin\nD" is "Vitamin D".
      .replace(/[\t\n\v\f\r\u0085\u2028\u2029]/g, " ")
      // Everything else non-printing goes, including the bidi overrides that
      // can make a stored name render as something other than what it is.
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
  );
}

export function sanitiseName(value: unknown): string {
  return sanitiseText(value, NAME_MAX);
}

export function sanitiseUnit(value: unknown): string {
  return sanitiseText(value, UNIT_MAX);
}

/**
 * Coerce arbitrary input into a storable amount, or null if it cannot be one.
 * Rejects NaN, Infinity, negatives, zero and anything over the ceiling, then
 * rounds to one decimal so stored values never carry float noise into totals.
 */
export function normaliseAmount(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > VALUE_MAX) return null;
  const rounded = Math.round(n * 10) / 10;
  return rounded > 0 ? rounded : null;
}

/** Formats a stored number for display without a pointless trailing ".0". */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
}

export function formatWithUnit(value: number, unit: string): string {
  return unit ? `${formatAmount(value)} ${unit}` : formatAmount(value);
}

export interface Suggestion {
  readonly name: string;
  readonly unit: string;
  readonly colour: ColourId;
}

/**
 * Starting points only. Every one of these still requires the user to type
 * their own target — the app ships no recommended values, because it has no
 * idea who is using it or why.
 */
export const SUGGESTIONS: readonly Suggestion[] = [
  { name: "Calories", unit: "kcal", colour: "amber" },
  { name: "Protein", unit: "g", colour: "blue" },
  { name: "Fibre", unit: "g", colour: "green" },
  { name: "Water", unit: "ml", colour: "cyan" },
  { name: "Coffee", unit: "cups", colour: "violet" },
  { name: "Baby feeds", unit: "oz", colour: "rose" },
  { name: "Creatine", unit: "doses", colour: "lime" },
];

/** Picks the next palette colour not already in use, so new trackers differ. */
export function nextColour(existing: readonly Tracker[]): ColourId {
  const used = new Set(existing.map((t) => t.colour));
  return COLOUR_IDS.find((c) => !used.has(c)) ?? DEFAULT_COLOUR;
}
