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
const { addEntry, buildExport, deleteEverything, getSnapshot, goToDate, hydrate, importFromCsv, removeEntry, setTargets, shiftDay, reloadFromStorage } = require("./store");
const { KEYS } = require("./storage");
const { todayKey, addDays } = require("./date");
const { totalsFor } = require("./schema");
const TARGETS = { calories: 2000, protein: 150, fibre: 30 };
(0, node_test_1.beforeEach)(() => {
    memory.failWrites = false;
    deleteEverything();
    hydrate();
});
(0, node_test_1.test)("a fresh install has no targets, so the app can ask for them", () => {
    strict_1.default.equal(getSnapshot().settings, null);
    strict_1.default.equal(getSnapshot().loggedDays.length, 0);
});
(0, node_test_1.test)("targets are persisted, not just held in memory", () => {
    setTargets(TARGETS);
    strict_1.default.deepEqual(getSnapshot().settings?.targets, TARGETS);
    const raw = memory.getItem(KEYS.settings);
    strict_1.default.ok(raw);
    strict_1.default.deepEqual(JSON.parse(raw).targets, TARGETS);
});
(0, node_test_1.test)("adding an entry updates totals and records the day in the index", () => {
    setTargets(TARGETS);
    strict_1.default.equal(addEntry("calories", 450), "added");
    strict_1.default.equal(addEntry("protein", 30), "added");
    const state = getSnapshot();
    const totals = totalsFor(state.day);
    strict_1.default.equal(totals.calories, 450);
    strict_1.default.equal(totals.protein, 30);
    strict_1.default.deepEqual([...state.loggedDays], [todayKey()]);
});
(0, node_test_1.test)("an entry only ever writes its own day's key", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    const dayKeys = Array.from({ length: memory.length }, (_, i) => memory.key(i)).filter((k) => k !== null && k.includes(".day."));
    strict_1.default.deepEqual(dayKeys, [KEYS.day(todayKey())]);
});
(0, node_test_1.test)("invalid amounts are rejected before they reach storage", () => {
    setTargets(TARGETS);
    strict_1.default.equal(addEntry("calories", -5), "invalid");
    strict_1.default.equal(addEntry("calories", 0), "invalid");
    strict_1.default.equal(addEntry("calories", NaN), "invalid");
    strict_1.default.equal(addEntry("calories", 99_999), "invalid");
    strict_1.default.equal(addEntry("calories", "abc"), "invalid");
    strict_1.default.equal(getSnapshot().day.entries.length, 0);
});
(0, node_test_1.test)("removing an entry removes exactly that entry", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    addEntry("calories", 200);
    const [first] = getSnapshot().day.entries;
    strict_1.default.ok(first);
    removeEntry(first.id);
    const entries = getSnapshot().day.entries;
    strict_1.default.equal(entries.length, 1);
    strict_1.default.equal(entries[0]?.amount, 200);
});
(0, node_test_1.test)("removing an unknown id is a no-op", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    removeEntry("does-not-exist");
    strict_1.default.equal(getSnapshot().day.entries.length, 1);
});
(0, node_test_1.test)("days are isolated from each other", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    shiftDay(-1);
    strict_1.default.equal(getSnapshot().day.entries.length, 0, "yesterday starts empty");
    addEntry("calories", 100);
    strict_1.default.equal(totalsFor(getSnapshot().day).calories, 100);
    shiftDay(1);
    strict_1.default.equal(totalsFor(getSnapshot().day).calories, 450, "today is unchanged");
    strict_1.default.equal(getSnapshot().loggedDays.length, 2);
});
(0, node_test_1.test)("the view cannot be moved into the future", () => {
    setTargets(TARGETS);
    const today = todayKey();
    goToDate(addDays(today, 5));
    strict_1.default.equal(getSnapshot().viewDate, today);
    shiftDay(1);
    strict_1.default.equal(getSnapshot().viewDate, today);
});
(0, node_test_1.test)("back-filling a past day works and is kept separate", () => {
    setTargets(TARGETS);
    const yesterday = addDays(todayKey(), -1);
    goToDate(yesterday);
    addEntry("fibre", 12);
    strict_1.default.equal(getSnapshot().viewDate, yesterday);
    strict_1.default.equal(totalsFor(getSnapshot().day).fibre, 12);
});
(0, node_test_1.test)("a failed write surfaces instead of pretending to have saved", () => {
    setTargets(TARGETS);
    memory.failWrites = true;
    addEntry("calories", 450);
    strict_1.default.equal(getSnapshot().writeFailed, true);
    // The entry still shows, so the user is not silently blocked mid-meal.
    strict_1.default.equal(getSnapshot().day.entries.length, 1);
});
(0, node_test_1.test)("a lost index is rebuilt from the day keys on disk", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    shiftDay(-1);
    addEntry("calories", 100);
    memory.removeItem(KEYS.index);
    reloadFromStorage();
    strict_1.default.equal(getSnapshot().loggedDays.length, 2, "history must not disappear with the index");
});
(0, node_test_1.test)("corrupt day data degrades to an empty day rather than crashing", () => {
    setTargets(TARGETS);
    memory.setItem(KEYS.day(todayKey()), "{not json");
    reloadFromStorage();
    strict_1.default.equal(getSnapshot().day.entries.length, 0);
});
(0, node_test_1.test)("export contains the targets and every logged day", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    shiftDay(-1);
    addEntry("protein", 40);
    const csv = buildExport();
    strict_1.default.match(csv, /^type,date,macro,amount,logged_at/);
    strict_1.default.match(csv, /target,,calories,2000,/);
    strict_1.default.equal(csv.split("\r\n").filter((l) => l.startsWith("entry,")).length, 2);
});
(0, node_test_1.test)("import replaces existing data rather than merging it", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    const backup = buildExport();
    addEntry("calories", 999);
    strict_1.default.equal(totalsFor(getSnapshot().day).calories, 1449);
    const report = importFromCsv(backup);
    strict_1.default.ok(report.ok);
    // Importing the same backup twice must not double the day's totals.
    strict_1.default.equal(totalsFor(getSnapshot().day).calories, 450);
});
(0, node_test_1.test)("import restores targets so a new device is usable immediately", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    const backup = buildExport();
    deleteEverything();
    strict_1.default.equal(getSnapshot().settings, null);
    const report = importFromCsv(backup);
    strict_1.default.ok(report.ok);
    strict_1.default.deepEqual(getSnapshot().settings?.targets, TARGETS);
    strict_1.default.equal(report.summary.entries, 1);
});
(0, node_test_1.test)("a rejected import leaves existing data untouched", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    const report = importFromCsv("nonsense,file\n1,2\n");
    strict_1.default.equal(report.ok, false);
    strict_1.default.equal(totalsFor(getSnapshot().day).calories, 450);
    strict_1.default.deepEqual(getSnapshot().settings?.targets, TARGETS);
});
(0, node_test_1.test)("delete removes every key the app owns", () => {
    setTargets(TARGETS);
    addEntry("calories", 450);
    shiftDay(-1);
    addEntry("protein", 40);
    memory.setItem("someone-elses-key", "keep me");
    deleteEverything();
    const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
    strict_1.default.deepEqual(remaining, ["someone-elses-key"]);
    strict_1.default.equal(getSnapshot().settings, null);
    strict_1.default.equal(getSnapshot().loggedDays.length, 0);
});
