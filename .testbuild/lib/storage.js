"use strict";
/**
 * The only module in the app that touches a persistence API.
 *
 * Everything is namespaced under `mt.v2.` and split one key per day, so adding
 * an entry rewrites just that day rather than the whole history — the cost of a
 * tap stays constant as the log grows to years of data.
 *
 * Swapping in native storage later (Capacitor Preferences, so iOS cannot evict
 * the data) means reimplementing this file's read/write functions and nothing
 * else.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_KEYS = exports.KEYS = void 0;
exports.isDayStorageKey = isDayStorageKey;
exports.isOwnedKey = isOwnedKey;
exports.storageAvailable = storageAvailable;
exports.readJson = readJson;
exports.writeJson = writeJson;
exports.removeKey = removeKey;
exports.ownedKeys = ownedKeys;
exports.clearAll = clearAll;
exports.clearLegacy = clearLegacy;
const PREFIX = "mt.v2.";
/** Pre-tracker schema, read once at startup so existing logs are not lost. */
const LEGACY_PREFIX = "mt.v1.";
/** Every namespace the app has ever owned, for enumeration and wiping. */
const ALL_PREFIXES = [PREFIX, LEGACY_PREFIX];
exports.KEYS = {
    settings: `${PREFIX}settings`,
    index: `${PREFIX}index`,
    day: (date) => `${PREFIX}day.${date}`,
};
exports.LEGACY_KEYS = {
    settings: `${LEGACY_PREFIX}settings`,
    index: `${LEGACY_PREFIX}index`,
    day: (date) => `${LEGACY_PREFIX}day.${date}`,
    prefix: LEGACY_PREFIX,
};
function isDayStorageKey(key) {
    return key.startsWith(`${PREFIX}day.`);
}
function isOwnedKey(key) {
    return ALL_PREFIXES.some((p) => key.startsWith(p));
}
/**
 * localStorage access throws rather than returning null in several real cases:
 * Safari private browsing, storage disabled by policy, and quota exhaustion.
 * A tracker that crashes on write is worse than one that quietly degrades, so
 * every call is guarded and failures are reported to the caller instead.
 */
function backend() {
    try {
        if (typeof window === "undefined")
            return null;
        const store = window.localStorage;
        // Touching the object is not enough; Safari only throws on use.
        const probe = `${PREFIX}probe`;
        store.setItem(probe, "1");
        store.removeItem(probe);
        return store;
    }
    catch {
        return null;
    }
}
let cachedBackend;
function store() {
    if (cachedBackend === undefined)
        cachedBackend = backend();
    return cachedBackend;
}
function storageAvailable() {
    return store() !== null;
}
/** Reads and JSON-parses a key. Returns null for missing *or* malformed data. */
function readJson(key) {
    const s = store();
    if (!s)
        return null;
    try {
        const raw = s.getItem(key);
        if (raw === null)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeJson(key, value) {
    const s = store();
    if (!s)
        return false;
    try {
        s.setItem(key, JSON.stringify(value));
        return true;
    }
    catch {
        return false;
    }
}
function removeKey(key) {
    const s = store();
    if (!s)
        return;
    try {
        s.removeItem(key);
    }
    catch {
        /* nothing useful to do */
    }
}
/** Every key this app owns, current and legacy. */
function ownedKeys() {
    const s = store();
    if (!s)
        return [];
    const keys = [];
    try {
        for (let i = 0; i < s.length; i += 1) {
            const key = s.key(i);
            if (key !== null && isOwnedKey(key))
                keys.push(key);
        }
    }
    catch {
        return [];
    }
    return keys;
}
function clearAll() {
    for (const key of ownedKeys())
        removeKey(key);
}
function clearLegacy() {
    for (const key of ownedKeys()) {
        if (key.startsWith(LEGACY_PREFIX))
            removeKey(key);
    }
}
