/**
 * The three tracked macros and their hard limits.
 *
 * Every limit here is enforced on the way *in* (user input) and again on the
 * way *out* (data read back from storage), because localStorage is writable by
 * anything running on this origin and by the user themselves. Nothing in the
 * app may assume a stored number is sane.
 */

export const MACRO_IDS = ["calories", "protein", "fibre"] as const;

export type MacroId = (typeof MACRO_IDS)[number];

export interface MacroMeta {
  readonly id: MacroId;
  readonly label: string;
  readonly unit: string;
  /** Largest value accepted for a single entry or a target. */
  readonly max: number;
  /** Decimal places kept. Calories are whole numbers; grams allow halves. */
  readonly precision: 0 | 1;
}

export const MACROS: Readonly<Record<MacroId, MacroMeta>> = {
  calories: { id: "calories", label: "Calories", unit: "kcal", max: 20_000, precision: 0 },
  protein: { id: "protein", label: "Protein", unit: "g", max: 2_000, precision: 1 },
  fibre: { id: "fibre", label: "Fibre", unit: "g", max: 2_000, precision: 1 },
};

export const MACRO_LIST: readonly MacroMeta[] = MACRO_IDS.map((id) => MACROS[id]);

export function isMacroId(value: unknown): value is MacroId {
  return typeof value === "string" && (MACRO_IDS as readonly string[]).includes(value);
}

/**
 * Coerce arbitrary input into a storable amount for a macro, or null if it
 * cannot be one. Rejects NaN, Infinity, negatives and zero, and anything above
 * the macro's ceiling. Rounds to the macro's precision so stored values never
 * carry float noise into the totals.
 */
export function normaliseAmount(value: unknown, macro: MacroId): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const meta = MACROS[macro];
  if (n > meta.max) return null;
  const factor = meta.precision === 0 ? 1 : 10;
  const rounded = Math.round(n * factor) / factor;
  return rounded > 0 ? rounded : null;
}

/** Same rules as an entry, but a target of 0 is meaningless so it is rejected too. */
export function normaliseTarget(value: unknown, macro: MacroId): number | null {
  return normaliseAmount(value, macro);
}

/** Formats a stored number for display without trailing ".0". */
export function formatAmount(value: number, macro: MacroId): string {
  const meta = MACROS[macro];
  if (meta.precision === 0) return Math.round(value).toLocaleString();
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
}
