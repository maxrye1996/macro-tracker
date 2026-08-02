"use strict";
/**
 * Shapes persisted to disk, plus the parsers that guard every read.
 *
 * These parsers are the trust boundary. Data in localStorage can be edited by
 * hand, corrupted by a half-finished write, or written by an older/newer build
 * of the app, so anything coming back out is treated as hostile input: parsed
 * field by field, never spread or `Object.assign`-ed into app state (which is
 * also what keeps a `__proto__` key in the JSON from reaching a prototype).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ENTRIES_PER_DAY = exports.SCHEMA_VERSION = void 0;
exports.parseTargets = parseTargets;
exports.parseSettings = parseSettings;
exports.serialiseSettings = serialiseSettings;
exports.parseDayLog = parseDayLog;
exports.serialiseDayLog = serialiseDayLog;
exports.parseIndex = parseIndex;
exports.serialiseIndex = serialiseIndex;
exports.createId = createId;
exports.emptyDay = emptyDay;
exports.totalsFor = totalsFor;
const date_1 = require("./date");
const macros_1 = require("./macros");
exports.SCHEMA_VERSION = 1;
/** Guards against a single pathological day blowing up render and storage. */
exports.MAX_ENTRIES_PER_DAY = 500;
/** Narrow unknown JSON to a plain object without inheriting anything from it. */
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return null;
    return value;
}
function asEpoch(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return null;
    // Reject timestamps outside a plausible range so a corrupt value cannot
    // produce an "Invalid Date" in the UI.
    if (value < 0 || value > 4_102_444_800_000 /* year 2100 */)
        return null;
    return Math.floor(value);
}
function parseTargets(value) {
    const raw = asRecord(value);
    if (!raw)
        return null;
    const out = {};
    for (const id of macros_1.MACRO_IDS) {
        const n = (0, macros_1.normaliseTarget)(raw[id], id);
        if (n === null)
            return null;
        out[id] = n;
    }
    return out;
}
function parseSettings(value) {
    const raw = asRecord(value);
    if (!raw || raw["v"] !== exports.SCHEMA_VERSION)
        return null;
    const targets = parseTargets(raw["targets"]);
    if (!targets)
        return null;
    return { targets, createdAt: asEpoch(raw["createdAt"]) ?? Date.now() };
}
function serialiseSettings(settings) {
    return { v: exports.SCHEMA_VERSION, targets: { ...settings.targets }, createdAt: settings.createdAt };
}
function parseEntry(value, fallbackAt) {
    const raw = asRecord(value);
    if (!raw)
        return null;
    const macro = raw["macro"];
    if (!(0, macros_1.isMacroId)(macro))
        return null;
    const amount = (0, macros_1.normaliseAmount)(raw["amount"], macro);
    if (amount === null)
        return null;
    const id = typeof raw["id"] === "string" && raw["id"].length > 0 && raw["id"].length <= 64
        ? raw["id"]
        : createId();
    return { id, macro, amount, at: asEpoch(raw["at"]) ?? fallbackAt };
}
function parseDayLog(value, expectedDate) {
    const raw = asRecord(value);
    if (!raw || raw["v"] !== exports.SCHEMA_VERSION)
        return null;
    if (raw["date"] !== expectedDate)
        return null;
    const rawEntries = raw["entries"];
    if (!Array.isArray(rawEntries))
        return null;
    const fallbackAt = new Date(`${expectedDate}T12:00:00`).getTime();
    const entries = [];
    const seen = new Set();
    for (const item of rawEntries.slice(0, exports.MAX_ENTRIES_PER_DAY)) {
        const entry = parseEntry(item, fallbackAt);
        // Drop unreadable rows rather than failing the whole day: losing one bad
        // entry is far better than showing an empty day for a corrupt byte.
        if (!entry || seen.has(entry.id))
            continue;
        seen.add(entry.id);
        entries.push(entry);
    }
    return { date: expectedDate, entries };
}
function serialiseDayLog(day) {
    return {
        v: exports.SCHEMA_VERSION,
        date: day.date,
        entries: day.entries.map((e) => ({ id: e.id, macro: e.macro, amount: e.amount, at: e.at })),
    };
}
function parseIndex(value) {
    const raw = asRecord(value);
    if (!raw || raw["v"] !== exports.SCHEMA_VERSION)
        return null;
    const days = raw["days"];
    if (!Array.isArray(days))
        return null;
    const unique = new Set();
    for (const day of days)
        if ((0, date_1.isDayKey)(day))
            unique.add(day);
    return [...unique].sort();
}
function serialiseIndex(days) {
    return { v: exports.SCHEMA_VERSION, days: [...days] };
}
/** Entry ids only need to be locally unique; they are never sent anywhere. */
function createId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function")
        return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
        const bytes = c.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function emptyDay(date) {
    return { date, entries: [] };
}
function totalsFor(day) {
    const totals = { calories: 0, protein: 0, fibre: 0 };
    for (const entry of day.entries)
        totals[entry.macro] += entry.amount;
    // Sum in float then round once, so 0.1 + 0.2 never surfaces as 0.30000000000000004.
    for (const id of macros_1.MACRO_IDS)
        totals[id] = Math.round(totals[id] * 10) / 10;
    return totals;
}
