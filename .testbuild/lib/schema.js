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
exports.parseTracker = parseTracker;
exports.parseTrackers = parseTrackers;
exports.parseSettings = parseSettings;
exports.serialiseSettings = serialiseSettings;
exports.parseDayLog = parseDayLog;
exports.serialiseDayLog = serialiseDayLog;
exports.parseIndex = parseIndex;
exports.serialiseIndex = serialiseIndex;
exports.createId = createId;
exports.middayOn = middayOn;
exports.emptyDay = emptyDay;
exports.totalsFor = totalsFor;
const date_1 = require("./date");
const trackers_1 = require("./trackers");
exports.SCHEMA_VERSION = 2;
/** Guards against a single pathological day blowing up render and storage. */
exports.MAX_ENTRIES_PER_DAY = 500;
/** Narrow unknown JSON to a plain object without inheriting anything from it. */
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return null;
    return value;
}
function asId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
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
function parseTracker(value) {
    const raw = asRecord(value);
    if (!raw)
        return null;
    const id = asId(raw["id"]);
    if (id === null)
        return null;
    const name = (0, trackers_1.sanitiseName)(raw["name"]);
    if (name === "")
        return null;
    const target = (0, trackers_1.normaliseAmount)(raw["target"]);
    if (target === null)
        return null;
    return {
        id,
        name,
        unit: (0, trackers_1.sanitiseUnit)(raw["unit"]),
        target,
        colour: (0, trackers_1.isColourId)(raw["colour"]) ? raw["colour"] : trackers_1.DEFAULT_COLOUR,
        archived: raw["archived"] === true,
    };
}
function parseTrackers(value) {
    if (!Array.isArray(value))
        return null;
    const out = [];
    const seen = new Set();
    for (const item of value) {
        if (out.length >= trackers_1.MAX_TRACKERS)
            break;
        const tracker = parseTracker(item);
        // A single unreadable tracker is dropped rather than losing the whole set.
        if (!tracker || seen.has(tracker.id))
            continue;
        seen.add(tracker.id);
        out.push(tracker);
    }
    return out;
}
function parseSettings(value) {
    const raw = asRecord(value);
    if (!raw || raw["v"] !== exports.SCHEMA_VERSION)
        return null;
    const trackers = parseTrackers(raw["trackers"]);
    if (!trackers)
        return null;
    return { trackers, createdAt: asEpoch(raw["createdAt"]) ?? Date.now() };
}
function serialiseSettings(settings) {
    return {
        v: exports.SCHEMA_VERSION,
        createdAt: settings.createdAt,
        trackers: settings.trackers.map((t) => ({
            id: t.id,
            name: t.name,
            unit: t.unit,
            target: t.target,
            colour: t.colour,
            archived: t.archived,
        })),
    };
}
function parseEntry(value, fallbackAt) {
    const raw = asRecord(value);
    if (!raw)
        return null;
    const trackerId = asId(raw["trackerId"]);
    if (trackerId === null)
        return null;
    const amount = (0, trackers_1.normaliseAmount)(raw["amount"]);
    if (amount === null)
        return null;
    const id = asId(raw["id"]) ?? createId();
    return { id, trackerId, amount, at: asEpoch(raw["at"]) ?? fallbackAt };
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
    const fallbackAt = middayOn(expectedDate);
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
        entries: day.entries.map((e) => ({
            id: e.id,
            trackerId: e.trackerId,
            amount: e.amount,
            at: e.at,
        })),
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
/** Ids only need to be locally unique; they are never sent anywhere. */
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
/** A neutral time-of-day for entries that arrive without a usable timestamp. */
function middayOn(date) {
    return new Date(`${date}T12:00:00`).getTime();
}
function emptyDay(date) {
    return { date, entries: [] };
}
/**
 * Totals keyed by tracker id. A Map rather than an object because the keys are
 * arbitrary strings and a Map has no prototype to collide with.
 */
function totalsFor(day) {
    const totals = new Map();
    for (const entry of day.entries) {
        totals.set(entry.trackerId, (totals.get(entry.trackerId) ?? 0) + entry.amount);
    }
    // Sum in float then round once, so 0.1 + 0.2 never surfaces as 0.30000000000000004.
    for (const [id, value] of totals)
        totals.set(id, Math.round(value * 10) / 10);
    return totals;
}
