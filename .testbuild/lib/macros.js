"use strict";
/**
 * The three tracked macros and their hard limits.
 *
 * Every limit here is enforced on the way *in* (user input) and again on the
 * way *out* (data read back from storage), because localStorage is writable by
 * anything running on this origin and by the user themselves. Nothing in the
 * app may assume a stored number is sane.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MACRO_LIST = exports.MACROS = exports.MACRO_IDS = void 0;
exports.isMacroId = isMacroId;
exports.normaliseAmount = normaliseAmount;
exports.normaliseTarget = normaliseTarget;
exports.formatAmount = formatAmount;
exports.MACRO_IDS = ["calories", "protein", "fibre"];
exports.MACROS = {
    calories: { id: "calories", label: "Calories", unit: "kcal", max: 20_000, precision: 0 },
    protein: { id: "protein", label: "Protein", unit: "g", max: 2_000, precision: 1 },
    fibre: { id: "fibre", label: "Fibre", unit: "g", max: 2_000, precision: 1 },
};
exports.MACRO_LIST = exports.MACRO_IDS.map((id) => exports.MACROS[id]);
function isMacroId(value) {
    return typeof value === "string" && exports.MACRO_IDS.includes(value);
}
/**
 * Coerce arbitrary input into a storable amount for a macro, or null if it
 * cannot be one. Rejects NaN, Infinity, negatives and zero, and anything above
 * the macro's ceiling. Rounds to the macro's precision so stored values never
 * carry float noise into the totals.
 */
function normaliseAmount(value, macro) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    const meta = exports.MACROS[macro];
    if (n > meta.max)
        return null;
    const factor = meta.precision === 0 ? 1 : 10;
    const rounded = Math.round(n * factor) / factor;
    return rounded > 0 ? rounded : null;
}
/** Same rules as an entry, but a target of 0 is meaningless so it is rejected too. */
function normaliseTarget(value, macro) {
    return normaliseAmount(value, macro);
}
/** Formats a stored number for display without trailing ".0". */
function formatAmount(value, macro) {
    const meta = exports.MACROS[macro];
    if (meta.precision === 0)
        return Math.round(value).toLocaleString();
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
}
