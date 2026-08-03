"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribe = subscribe;
exports.getSnapshot = getSnapshot;
exports.getServerSnapshot = getServerSnapshot;
exports.hydrate = hydrate;
exports.activeTrackers = activeTrackers;
exports.archivedTrackers = archivedTrackers;
exports.addTracker = addTracker;
exports.setTrackers = setTrackers;
exports.updateTracker = updateTracker;
exports.hasEntries = hasEntries;
exports.countEntries = countEntries;
exports.removeTracker = removeTracker;
exports.restoreTracker = restoreTracker;
exports.moveTracker = moveTracker;
exports.addEntry = addEntry;
exports.removeEntry = removeEntry;
exports.goToDate = goToDate;
exports.shiftDay = shiftDay;
exports.refreshToday = refreshToday;
exports.reloadFromStorage = reloadFromStorage;
exports.buildExport = buildExport;
exports.importFromCsv = importFromCsv;
exports.deleteEverything = deleteEverything;
const csv_1 = require("./csv");
const date_1 = require("./date");
const migrate_1 = require("./migrate");
const schema_1 = require("./schema");
const storage_1 = require("./storage");
const trackers_1 = require("./trackers");
const INITIAL = Object.freeze({
    hydrated: false,
    storageOk: true,
    writeFailed: false,
    settings: null,
    today: "1970-01-01",
    viewDate: "1970-01-01",
    day: (0, schema_1.emptyDay)("1970-01-01"),
    loggedDays: [],
});
let state = INITIAL;
const listeners = new Set();
/** Bounded memory cache of parsed days; history browsing stays cheap. */
const DAY_CACHE_LIMIT = 32;
const dayCache = new Map();
function cacheDay(day) {
    dayCache.delete(day.date);
    dayCache.set(day.date, day);
    if (dayCache.size > DAY_CACHE_LIMIT) {
        const oldest = dayCache.keys().next();
        if (!oldest.done)
            dayCache.delete(oldest.value);
    }
    return day;
}
function loadDay(date) {
    const cached = dayCache.get(date);
    if (cached)
        return cached;
    const parsed = (0, schema_1.parseDayLog)((0, storage_1.readJson)(storage_1.KEYS.day(date)), date) ?? (0, schema_1.emptyDay)(date);
    return cacheDay(parsed);
}
function setState(patch) {
    state = { ...state, ...patch };
    for (const listener of listeners)
        listener();
}
function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
function getSnapshot() {
    return state;
}
function getServerSnapshot() {
    return INITIAL;
}
let hydrating = false;
function hydrate() {
    if (state.hydrated || hydrating)
        return;
    hydrating = true;
    const storageOk = (0, storage_1.storageAvailable)();
    let settings = storageOk ? (0, schema_1.parseSettings)((0, storage_1.readJson)(storage_1.KEYS.settings)) : null;
    let loggedDays = (storageOk ? (0, schema_1.parseIndex)((0, storage_1.readJson)(storage_1.KEYS.index)) : null) ?? recoverIndex();
    // Nothing under the current schema — see whether an older install is there.
    if (storageOk && !settings) {
        const migrated = (0, migrate_1.migrateLegacy)();
        if (migrated) {
            settings = migrated.settings;
            loggedDays = migrated.days;
        }
    }
    const today = (0, date_1.todayKey)();
    state = {
        hydrated: true,
        storageOk,
        writeFailed: false,
        settings,
        today,
        viewDate: today,
        day: storageOk ? loadDay(today) : (0, schema_1.emptyDay)(today),
        loggedDays,
    };
    hydrating = false;
    for (const listener of listeners)
        listener();
}
/**
 * If the index key is missing or corrupt, rebuild it by scanning our own keys.
 * Cheap (localStorage enumeration only) and means a lost index never hides a
 * user's history.
 */
function recoverIndex() {
    const days = (0, storage_1.ownedKeys)()
        .filter(storage_1.isDayStorageKey)
        .map((key) => key.slice(key.lastIndexOf(".") + 1))
        .sort();
    if (days.length > 0)
        (0, storage_1.writeJson)(storage_1.KEYS.index, (0, schema_1.serialiseIndex)(days));
    return days;
}
function persistDay(day) {
    cacheDay(day);
    return (0, storage_1.writeJson)(storage_1.KEYS.day(day.date), (0, schema_1.serialiseDayLog)(day));
}
function withDayInIndex(date) {
    if (state.loggedDays.includes(date))
        return state.loggedDays;
    const next = [...state.loggedDays, date].sort();
    (0, storage_1.writeJson)(storage_1.KEYS.index, (0, schema_1.serialiseIndex)(next));
    return next;
}
function persistSettings(trackers) {
    const settings = {
        trackers,
        createdAt: state.settings?.createdAt ?? Date.now(),
    };
    const ok = (0, storage_1.writeJson)(storage_1.KEYS.settings, (0, schema_1.serialiseSettings)(settings));
    setState({ settings, writeFailed: state.writeFailed || !ok });
}
// --------------------------------------------------------------- trackers ---
function activeTrackers(snapshot = state) {
    return snapshot.settings?.trackers.filter((t) => !t.archived) ?? [];
}
function archivedTrackers(snapshot = state) {
    return snapshot.settings?.trackers.filter((t) => t.archived) ?? [];
}
function addTracker(draft) {
    const existing = state.settings?.trackers ?? [];
    if (existing.length >= trackers_1.MAX_TRACKERS)
        return "full";
    const name = (0, trackers_1.sanitiseName)(draft.name);
    const target = (0, trackers_1.normaliseAmount)(draft.target);
    if (name === "" || target === null)
        return "invalid";
    const tracker = {
        id: (0, schema_1.createId)(),
        name,
        unit: (0, trackers_1.sanitiseUnit)(draft.unit),
        target,
        colour: draft.colour ?? (0, trackers_1.nextColour)(existing),
        archived: false,
    };
    persistSettings([...existing, tracker]);
    return "added";
}
/** Replaces the whole list; used by first-run setup where order is authored. */
function setTrackers(trackers) {
    persistSettings(trackers.slice(0, trackers_1.MAX_TRACKERS));
}
function updateTracker(id, patch) {
    const existing = state.settings?.trackers ?? [];
    const current = existing.find((t) => t.id === id);
    if (!current)
        return "invalid";
    const name = patch.name === undefined ? current.name : (0, trackers_1.sanitiseName)(patch.name);
    const target = patch.target === undefined ? current.target : (0, trackers_1.normaliseAmount)(patch.target);
    if (name === "" || target === null)
        return "invalid";
    const updated = {
        ...current,
        name,
        target,
        unit: patch.unit === undefined ? current.unit : (0, trackers_1.sanitiseUnit)(patch.unit),
        colour: patch.colour ?? current.colour,
    };
    persistSettings(existing.map((t) => (t.id === id ? updated : t)));
    return "added";
}
/** True as soon as one entry exists for the tracker; stops looking after that. */
function hasEntries(trackerId) {
    for (const date of state.loggedDays) {
        if (loadDay(date).entries.some((e) => e.trackerId === trackerId))
            return true;
    }
    return false;
}
function countEntries(trackerId) {
    let count = 0;
    for (const date of state.loggedDays) {
        for (const entry of loadDay(date).entries)
            if (entry.trackerId === trackerId)
                count += 1;
    }
    return count;
}
/**
 * Taking a tracker off the daily view never destroys anything a user logged:
 * one with history is archived and keeps every entry, one that was never used
 * has nothing to preserve and is simply removed.
 */
function removeTracker(id) {
    const existing = state.settings?.trackers ?? [];
    if (!existing.some((t) => t.id === id))
        return "unknown";
    if (hasEntries(id)) {
        persistSettings(existing.map((t) => (t.id === id ? { ...t, archived: true } : t)));
        return "archived";
    }
    persistSettings(existing.filter((t) => t.id !== id));
    return "deleted";
}
/** False when the active list is already full, so the caller can say why. */
function restoreTracker(id) {
    const existing = state.settings?.trackers ?? [];
    if (!existing.some((t) => t.id === id))
        return false;
    if (existing.filter((t) => !t.archived).length >= trackers_1.MAX_TRACKERS)
        return false;
    persistSettings(existing.map((t) => (t.id === id ? { ...t, archived: false } : t)));
    return true;
}
/** Moves a tracker within the active list; archived ones keep their place. */
function moveTracker(id, delta) {
    const existing = [...(state.settings?.trackers ?? [])];
    const from = existing.findIndex((t) => t.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= existing.length)
        return;
    const moved = existing[from];
    const target = existing[to];
    if (!moved || !target)
        return;
    existing[from] = target;
    existing[to] = moved;
    persistSettings(existing);
}
function addEntry(trackerId, rawAmount) {
    const amount = (0, trackers_1.normaliseAmount)(rawAmount);
    if (amount === null)
        return "invalid";
    if (!state.settings?.trackers.some((t) => t.id === trackerId))
        return "invalid";
    const current = state.day;
    if (current.entries.length >= schema_1.MAX_ENTRIES_PER_DAY)
        return "day-full";
    const entry = { id: (0, schema_1.createId)(), trackerId, amount, at: Date.now() };
    const day = { date: current.date, entries: [...current.entries, entry] };
    const ok = persistDay(day);
    setState({
        day,
        loggedDays: withDayInIndex(day.date),
        writeFailed: state.writeFailed || !ok,
    });
    return "added";
}
function removeEntry(id) {
    const current = state.day;
    const entries = current.entries.filter((e) => e.id !== id);
    if (entries.length === current.entries.length)
        return;
    const day = { date: current.date, entries };
    const ok = persistDay(day);
    setState({ day, writeFailed: state.writeFailed || !ok });
}
// ------------------------------------------------------------------- days ---
function goToDate(date) {
    if (date === state.viewDate)
        return;
    // Never allow logging into the future; there is nothing to record there.
    const clamped = date > state.today ? state.today : date;
    setState({ viewDate: clamped, day: loadDay(clamped) });
}
function shiftDay(delta) {
    goToDate((0, date_1.addDays)(state.viewDate, delta));
}
/** Called by the midnight timer and on app resume, so a day never goes stale. */
function refreshToday() {
    const today = (0, date_1.todayKey)();
    if (today === state.today)
        return;
    const followToday = state.viewDate === state.today;
    const viewDate = followToday ? today : state.viewDate;
    setState({ today, viewDate, day: loadDay(viewDate) });
}
/** Re-read from disk after another tab wrote. */
function reloadFromStorage() {
    if (!state.hydrated)
        return;
    dayCache.clear();
    const settings = (0, schema_1.parseSettings)((0, storage_1.readJson)(storage_1.KEYS.settings));
    const loggedDays = (0, schema_1.parseIndex)((0, storage_1.readJson)(storage_1.KEYS.index)) ?? recoverIndex();
    setState({ settings, loggedDays, day: loadDay(state.viewDate) });
}
// ------------------------------------------------------------ backup / io ---
function buildExport() {
    const trackers = state.settings?.trackers;
    if (!trackers || trackers.length === 0)
        return "";
    const days = state.loggedDays.map(loadDay).filter((day) => day.entries.length > 0);
    return (0, csv_1.exportCsv)(trackers, days);
}
/**
 * Replaces all local data with the file's contents. Replace rather than merge
 * is the honest behaviour for a "restore my backup" button: merging would
 * silently double every entry if a file is imported twice.
 */
function importFromCsv(text) {
    const outcome = (0, csv_1.parseCsv)(text);
    if (!outcome.ok)
        return { ok: false, error: outcome.error };
    const { trackers, days, imported, skipped } = outcome.value;
    (0, storage_1.clearAll)();
    dayCache.clear();
    let writeFailed = false;
    const dayKeys = [];
    for (const day of days) {
        if (day.entries.length === 0)
            continue;
        if (!persistDay(day))
            writeFailed = true;
        dayKeys.push(day.date);
    }
    if (!(0, storage_1.writeJson)(storage_1.KEYS.index, (0, schema_1.serialiseIndex)(dayKeys)))
        writeFailed = true;
    const settings = {
        trackers: trackers.length > 0 ? trackers : (state.settings?.trackers ?? []),
        createdAt: state.settings?.createdAt ?? Date.now(),
    };
    if (!(0, storage_1.writeJson)(storage_1.KEYS.settings, (0, schema_1.serialiseSettings)(settings)))
        writeFailed = true;
    const today = (0, date_1.todayKey)();
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
            trackers: settings.trackers.length,
            skipped,
        },
    };
}
/** Wipes every key this app owns and returns to first-run. */
function deleteEverything() {
    (0, storage_1.clearAll)();
    dayCache.clear();
    const today = (0, date_1.todayKey)();
    setState({
        settings: null,
        today,
        viewDate: today,
        day: (0, schema_1.emptyDay)(today),
        loggedDays: [],
        writeFailed: false,
    });
}
