"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacy = migrateLegacy;
const date_1 = require("./date");
const schema_1 = require("./schema");
const storage_1 = require("./storage");
const trackers_1 = require("./trackers");
const LEGACY_MACROS = [
    { id: "calories", name: "Calories", unit: "kcal", colour: "amber" },
    { id: "protein", name: "Protein", unit: "g", colour: "blue" },
    { id: "fibre", name: "Fibre", unit: "g", colour: "green" },
];
function asRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return null;
    return value;
}
function legacyTrackers(targets) {
    const trackers = [];
    for (const macro of LEGACY_MACROS) {
        const target = (0, trackers_1.normaliseAmount)(targets[macro.id]);
        if (target === null)
            continue;
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
function legacyDayKeys() {
    const index = asRecord((0, storage_1.readJson)(storage_1.LEGACY_KEYS.index));
    const listed = Array.isArray(index?.["days"]) ? index["days"] : [];
    const keys = new Set();
    for (const day of listed)
        if ((0, date_1.isDayKey)(day))
            keys.add(day);
    // Also sweep the raw keys, in case the old index was lost or truncated.
    const dayPrefix = `${storage_1.LEGACY_KEYS.prefix}day.`;
    for (const key of (0, storage_1.ownedKeys)()) {
        if (!key.startsWith(dayPrefix))
            continue;
        const date = key.slice(dayPrefix.length);
        if ((0, date_1.isDayKey)(date))
            keys.add(date);
    }
    return [...keys].sort();
}
function legacyEntries(value, date) {
    const raw = asRecord(value);
    if (!raw || !Array.isArray(raw["entries"]))
        return [];
    const known = new Set(LEGACY_MACROS.map((m) => m.id));
    const entries = [];
    for (const item of raw["entries"]) {
        const entry = asRecord(item);
        if (!entry)
            continue;
        const macro = entry["macro"];
        if (typeof macro !== "string" || !known.has(macro))
            continue;
        const amount = (0, trackers_1.normaliseAmount)(entry["amount"]);
        if (amount === null)
            continue;
        const at = typeof entry["at"] === "number" && Number.isFinite(entry["at"]) ? entry["at"] : null;
        entries.push({
            id: typeof entry["id"] === "string" && entry["id"] ? entry["id"] : (0, schema_1.createId)(),
            trackerId: macro,
            amount,
            at: at ?? new Date(`${date}T12:00:00`).getTime(),
        });
    }
    return entries;
}
/** Returns null when there is nothing from the old schema to bring across. */
function migrateLegacy() {
    const rawSettings = asRecord((0, storage_1.readJson)(storage_1.LEGACY_KEYS.settings));
    if (!rawSettings)
        return null;
    const targets = asRecord(rawSettings["targets"]);
    const trackers = targets ? legacyTrackers(targets) : [];
    if (trackers.length === 0) {
        // Nothing usable in the old settings; drop them so this does not re-run.
        (0, storage_1.clearLegacy)();
        return null;
    }
    const createdAt = typeof rawSettings["createdAt"] === "number" && Number.isFinite(rawSettings["createdAt"])
        ? rawSettings["createdAt"]
        : Date.now();
    const migrated = [];
    let ok = true;
    for (const date of legacyDayKeys()) {
        const entries = legacyEntries((0, storage_1.readJson)(storage_1.LEGACY_KEYS.day(date)), date);
        if (entries.length === 0)
            continue;
        const day = { date, entries };
        if ((0, storage_1.writeJson)(storage_1.KEYS.day(date), (0, schema_1.serialiseDayLog)(day)))
            migrated.push(date);
        else
            ok = false;
    }
    const settings = { trackers, createdAt };
    if (!(0, storage_1.writeJson)(storage_1.KEYS.settings, (0, schema_1.serialiseSettings)(settings)))
        ok = false;
    if (!(0, storage_1.writeJson)(storage_1.KEYS.index, (0, schema_1.serialiseIndex)(migrated)))
        ok = false;
    // Only let go of the old data once the new copy is definitely on disk.
    if (ok)
        (0, storage_1.clearLegacy)();
    return { settings, days: migrated };
}
