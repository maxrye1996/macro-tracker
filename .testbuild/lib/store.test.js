"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
/**
 * Minimal localStorage stand-in. Installed before anything touches the storage
 * module so the real code path — including its availability probe — runs
 * unchanged under test.
 */
class MemoryStorage {
    map = new Map();
    get length() {
        return this.map.size;
    }
    key(i) {
        return [...this.map.keys()][i] ?? null;
    }
    getItem(k) {
        return this.map.get(k) ?? null;
    }
    setItem(k, v) {
        if (this.failWrites)
            throw new DOMException("QuotaExceededError");
        this.map.set(k, String(v));
    }
    removeItem(k) {
        this.map.delete(k);
    }
    clear() {
        this.map.clear();
    }
    failWrites = false;
}
const memory = new MemoryStorage();
globalThis.window = { localStorage: memory };
// Imported after the shim exists.
const store = require("./store");
const { addEntry, addTracker, buildExport, countEntries, deleteEverything, getSnapshot, goToDate, hydrate, importFromCsv, moveTracker, reloadFromStorage, removeEntry, removeTracker, restoreTracker, setTrackers, shiftDay, updateTracker, } = store;
const { KEYS } = require("./storage");
const { todayKey, addDays } = require("./date");
const { totalsFor } = require("./schema");
const { MAX_TRACKERS } = require("./trackers");
function trackerIdByName(name) {
    const tracker = getSnapshot().settings?.trackers.find((t) => t.name === name);
    strict_1.default.ok(tracker, `no tracker named ${name}`);
    return tracker.id;
}
function totalFor(name) {
    return totalsFor(getSnapshot().day).get(trackerIdByName(name)) ?? 0;
}
/** Two trackers is enough to prove per-tracker isolation. */
function seed() {
    strict_1.default.equal(addTracker({ name: "Calories", unit: "kcal", target: 2000 }), "added");
    strict_1.default.equal(addTracker({ name: "Water", unit: "ml", target: 2500 }), "added");
}
(0, node_test_1.beforeEach)(() => {
    memory.failWrites = false;
    deleteEverything();
    hydrate();
});
(0, node_test_1.test)("a fresh install has no trackers, so the app asks for them", () => {
    strict_1.default.equal(getSnapshot().settings, null);
    strict_1.default.equal(getSnapshot().loggedDays.length, 0);
});
(0, node_test_1.test)("trackers are persisted, not just held in memory", () => {
    seed();
    const raw = memory.getItem(KEYS.settings);
    strict_1.default.ok(raw);
    const parsed = JSON.parse(raw);
    strict_1.default.deepEqual(parsed.trackers.map((t) => t.name), ["Calories", "Water"]);
});
(0, node_test_1.test)("a tracker with no name or no usable target is rejected", () => {
    strict_1.default.equal(addTracker({ name: "  ", unit: "g", target: 10 }), "invalid");
    strict_1.default.equal(addTracker({ name: "Salt", unit: "g", target: 0 }), "invalid");
    strict_1.default.equal(addTracker({ name: "Salt", unit: "g", target: "loads" }), "invalid");
    strict_1.default.equal(getSnapshot().settings, null);
});
(0, node_test_1.test)("new trackers are given distinct colours", () => {
    seed();
    const colours = getSnapshot().settings?.trackers.map((t) => t.colour) ?? [];
    strict_1.default.equal(new Set(colours).size, colours.length);
});
(0, node_test_1.test)("the number of trackers is capped", () => {
    for (let i = 0; i < MAX_TRACKERS; i += 1) {
        strict_1.default.equal(addTracker({ name: `T${i}`, unit: "", target: 10 }), "added");
    }
    strict_1.default.equal(addTracker({ name: "One too many", unit: "", target: 10 }), "full");
    strict_1.default.equal(getSnapshot().settings?.trackers.length, MAX_TRACKERS);
});
(0, node_test_1.test)("editing a tracker keeps its id, so existing entries stay attached", () => {
    seed();
    const id = trackerIdByName("Water");
    addEntry(id, 500);
    strict_1.default.equal(updateTracker(id, { name: "Hydration", target: 3000 }), "added");
    strict_1.default.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.name, "Hydration");
    strict_1.default.equal(totalFor("Hydration"), 500);
});
(0, node_test_1.test)("an invalid edit is refused and leaves the stored tracker alone", () => {
    seed();
    const id = trackerIdByName("Water");
    strict_1.default.equal(updateTracker(id, { name: "   " }), "invalid");
    strict_1.default.equal(updateTracker(id, { target: -1 }), "invalid");
    strict_1.default.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.name, "Water");
});
(0, node_test_1.test)("adding an entry updates that tracker's total only", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    strict_1.default.equal(totalFor("Calories"), 450);
    strict_1.default.equal(totalFor("Water"), 0);
    strict_1.default.deepEqual([...getSnapshot().loggedDays], [todayKey()]);
});
(0, node_test_1.test)("an entry only ever writes its own day's key", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    const dayKeys = Array.from({ length: memory.length }, (_, i) => memory.key(i)).filter((k) => k !== null && k.includes(".day."));
    strict_1.default.deepEqual(dayKeys, [KEYS.day(todayKey())]);
});
(0, node_test_1.test)("invalid amounts are rejected before they reach storage", () => {
    seed();
    const id = trackerIdByName("Calories");
    for (const bad of [-5, 0, NaN, 9_999_999, "abc"]) {
        strict_1.default.equal(addEntry(id, bad), "invalid", `expected ${String(bad)} to be rejected`);
    }
    strict_1.default.equal(getSnapshot().day.entries.length, 0);
});
(0, node_test_1.test)("an entry for an unknown tracker is refused", () => {
    seed();
    // Otherwise a stale id could write a row nothing can ever display or delete.
    strict_1.default.equal(addEntry("no-such-tracker", 100), "invalid");
    strict_1.default.equal(getSnapshot().day.entries.length, 0);
});
(0, node_test_1.test)("removing an entry removes exactly that entry", () => {
    seed();
    const id = trackerIdByName("Calories");
    addEntry(id, 450);
    addEntry(id, 200);
    const [first] = getSnapshot().day.entries;
    strict_1.default.ok(first);
    removeEntry(first.id);
    strict_1.default.equal(getSnapshot().day.entries.length, 1);
    strict_1.default.equal(getSnapshot().day.entries[0]?.amount, 200);
});
(0, node_test_1.test)("removing a tracker with history archives it and keeps every entry", () => {
    seed();
    const id = trackerIdByName("Water");
    addEntry(id, 500);
    strict_1.default.equal(removeTracker(id), "archived");
    const tracker = getSnapshot().settings?.trackers.find((t) => t.id === id);
    strict_1.default.equal(tracker?.archived, true, "the tracker itself is kept");
    strict_1.default.equal(countEntries(id), 1, "its entries are kept");
    strict_1.default.equal(getSnapshot().day.entries.length, 1);
});
(0, node_test_1.test)("removing a tracker that was never used deletes it outright", () => {
    seed();
    const id = trackerIdByName("Water");
    strict_1.default.equal(removeTracker(id), "deleted");
    strict_1.default.equal(getSnapshot().settings?.trackers.some((t) => t.id === id), false, "nothing to preserve, so nothing is left behind");
});
(0, node_test_1.test)("an archived tracker can be restored with its history intact", () => {
    seed();
    const id = trackerIdByName("Water");
    addEntry(id, 500);
    removeTracker(id);
    restoreTracker(id);
    strict_1.default.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.archived, false);
    strict_1.default.equal(totalFor("Water"), 500);
});
(0, node_test_1.test)("removing an unknown tracker is a no-op", () => {
    seed();
    strict_1.default.equal(removeTracker("nope"), "unknown");
    strict_1.default.equal(getSnapshot().settings?.trackers.length, 2);
});
(0, node_test_1.test)("trackers can be reordered, and moves past either end do nothing", () => {
    seed();
    const water = trackerIdByName("Water");
    moveTracker(water, -1);
    strict_1.default.deepEqual(getSnapshot().settings?.trackers.map((t) => t.name), ["Water", "Calories"]);
    moveTracker(water, -1);
    strict_1.default.deepEqual(getSnapshot().settings?.trackers.map((t) => t.name), ["Water", "Calories"], "already first");
});
(0, node_test_1.test)("setTrackers replaces the whole list, as first-run setup does", () => {
    setTrackers([
        { id: "a", name: "Steps", unit: "", target: 8000, colour: "lime", archived: false },
    ]);
    strict_1.default.equal(getSnapshot().settings?.trackers.length, 1);
    strict_1.default.equal(getSnapshot().settings?.trackers[0]?.name, "Steps");
});
(0, node_test_1.test)("days are isolated from each other", () => {
    seed();
    const id = trackerIdByName("Calories");
    addEntry(id, 450);
    shiftDay(-1);
    strict_1.default.equal(getSnapshot().day.entries.length, 0, "yesterday starts empty");
    addEntry(id, 100);
    strict_1.default.equal(totalFor("Calories"), 100);
    shiftDay(1);
    strict_1.default.equal(totalFor("Calories"), 450, "today is unchanged");
    strict_1.default.equal(getSnapshot().loggedDays.length, 2);
});
(0, node_test_1.test)("the view cannot be moved into the future", () => {
    seed();
    const today = todayKey();
    goToDate(addDays(today, 5));
    strict_1.default.equal(getSnapshot().viewDate, today);
    shiftDay(1);
    strict_1.default.equal(getSnapshot().viewDate, today);
});
(0, node_test_1.test)("a failed write surfaces instead of pretending to have saved", () => {
    seed();
    memory.failWrites = true;
    addEntry(trackerIdByName("Calories"), 450);
    strict_1.default.equal(getSnapshot().writeFailed, true);
    // The entry still shows, so the user is not silently blocked mid-meal.
    strict_1.default.equal(getSnapshot().day.entries.length, 1);
});
(0, node_test_1.test)("a lost index is rebuilt from the day keys on disk", () => {
    seed();
    const id = trackerIdByName("Calories");
    addEntry(id, 450);
    shiftDay(-1);
    addEntry(id, 100);
    memory.removeItem(KEYS.index);
    reloadFromStorage();
    strict_1.default.equal(getSnapshot().loggedDays.length, 2, "history must not disappear with the index");
});
(0, node_test_1.test)("corrupt day data degrades to an empty day rather than crashing", () => {
    seed();
    memory.setItem(KEYS.day(todayKey()), "{not json");
    reloadFromStorage();
    strict_1.default.equal(getSnapshot().day.entries.length, 0);
});
(0, node_test_1.test)("export contains every tracker and every logged day", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    shiftDay(-1);
    addEntry(trackerIdByName("Water"), 500);
    const csv = buildExport();
    strict_1.default.match(csv, /^type,date,tracker_id,name,unit,amount,logged_at,colour,archived/);
    strict_1.default.equal(csv.split("\r\n").filter((l) => l.startsWith("tracker,")).length, 2);
    strict_1.default.equal(csv.split("\r\n").filter((l) => l.startsWith("entry,")).length, 2);
});
(0, node_test_1.test)("import replaces existing data rather than merging it", () => {
    seed();
    const id = trackerIdByName("Calories");
    addEntry(id, 450);
    const backup = buildExport();
    addEntry(id, 999);
    strict_1.default.equal(totalFor("Calories"), 1449);
    strict_1.default.ok(importFromCsv(backup).ok);
    // Importing the same backup twice must not double the day's totals.
    strict_1.default.equal(totalFor("Calories"), 450);
});
(0, node_test_1.test)("import restores trackers so a new device is usable immediately", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    const backup = buildExport();
    deleteEverything();
    strict_1.default.equal(getSnapshot().settings, null);
    const report = importFromCsv(backup);
    strict_1.default.ok(report.ok);
    strict_1.default.equal(report.summary.trackers, 2);
    strict_1.default.equal(report.summary.entries, 1);
    strict_1.default.equal(totalFor("Calories"), 450);
});
(0, node_test_1.test)("a rejected import leaves existing data untouched", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    strict_1.default.equal(importFromCsv("nonsense,file\n1,2\n").ok, false);
    strict_1.default.equal(totalFor("Calories"), 450);
    strict_1.default.equal(getSnapshot().settings?.trackers.length, 2);
});
(0, node_test_1.test)("delete removes every key the app owns and nothing else", () => {
    seed();
    addEntry(trackerIdByName("Calories"), 450);
    shiftDay(-1);
    addEntry(trackerIdByName("Water"), 500);
    memory.setItem("someone-elses-key", "keep me");
    deleteEverything();
    const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
    strict_1.default.deepEqual(remaining, ["someone-elses-key"]);
    strict_1.default.equal(getSnapshot().settings, null);
    strict_1.default.equal(getSnapshot().loggedDays.length, 0);
});
