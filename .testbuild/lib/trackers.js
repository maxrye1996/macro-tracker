"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUGGESTIONS = exports.DEFAULT_COLOUR = exports.COLOUR_IDS = exports.MAX_TRACKERS = exports.VALUE_MAX = exports.UNIT_MAX = exports.NAME_MAX = void 0;
exports.isColourId = isColourId;
exports.colourVar = colourVar;
exports.sanitiseText = sanitiseText;
exports.sanitiseName = sanitiseName;
exports.sanitiseUnit = sanitiseUnit;
exports.normaliseAmount = normaliseAmount;
exports.formatAmount = formatAmount;
exports.formatWithUnit = formatWithUnit;
exports.nextColour = nextColour;
exports.NAME_MAX = 24;
exports.UNIT_MAX = 8;
/** One ceiling for everything: covers kcal, ml, mg, steps. */
exports.VALUE_MAX = 1_000_000;
/** Bounds the horizontal rail, storage size, and per-render work. */
exports.MAX_TRACKERS = 20;
exports.COLOUR_IDS = [
    "amber",
    "blue",
    "green",
    "violet",
    "rose",
    "cyan",
    "lime",
    "slate",
];
exports.DEFAULT_COLOUR = "blue";
function isColourId(value) {
    return typeof value === "string" && exports.COLOUR_IDS.includes(value);
}
/** Maps to the custom properties declared in globals.css. */
function colourVar(colour) {
    return `var(--c-${colour})`;
}
/**
 * Strips control characters (including the bidi overrides that can make a
 * name render as something other than what is stored), collapses runs of
 * whitespace, and caps the length.
 */
function sanitiseText(value, max) {
    if (typeof value !== "string")
        return "";
    return (value
        // Line breaks and tabs are word separators, so they become a space
        // rather than being deleted: a pasted "Vitamin\nD" is "Vitamin D".
        .replace(/[\t\n\v\f\r\u0085\u2028\u2029]/g, " ")
        // Everything else non-printing goes, including the bidi overrides that
        // can make a stored name render as something other than what it is.
        .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max));
}
function sanitiseName(value) {
    return sanitiseText(value, exports.NAME_MAX);
}
function sanitiseUnit(value) {
    return sanitiseText(value, exports.UNIT_MAX);
}
/**
 * Coerce arbitrary input into a storable amount, or null if it cannot be one.
 * Rejects NaN, Infinity, negatives, zero and anything over the ceiling, then
 * rounds to one decimal so stored values never carry float noise into totals.
 */
function normaliseAmount(value) {
    const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > exports.VALUE_MAX)
        return null;
    const rounded = Math.round(n * 10) / 10;
    return rounded > 0 ? rounded : null;
}
/** Formats a stored number for display without a pointless trailing ".0". */
function formatAmount(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1);
}
function formatWithUnit(value, unit) {
    return unit ? `${formatAmount(value)} ${unit}` : formatAmount(value);
}
/**
 * Starting points only. Every one of these still requires the user to type
 * their own target — the app ships no recommended values, because it has no
 * idea who is using it or why.
 */
exports.SUGGESTIONS = [
    { name: "Calories", unit: "kcal", colour: "amber" },
    { name: "Protein", unit: "g", colour: "blue" },
    { name: "Fibre", unit: "g", colour: "green" },
    { name: "Water", unit: "ml", colour: "cyan" },
    { name: "Carbs", unit: "g", colour: "violet" },
    { name: "Fat", unit: "g", colour: "rose" },
    { name: "Sugar", unit: "g", colour: "rose" },
    { name: "Salt", unit: "g", colour: "slate" },
    { name: "Steps", unit: "", colour: "lime" },
    { name: "Caffeine", unit: "mg", colour: "amber" },
];
/** Picks the next palette colour not already in use, so new trackers differ. */
function nextColour(existing) {
    const used = new Set(existing.map((t) => t.colour));
    return exports.COLOUR_IDS.find((c) => !used.has(c)) ?? exports.DEFAULT_COLOUR;
}
