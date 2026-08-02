import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

/**
 * Minimal localStorage stand-in. Installed before anything touches the storage
 * module so the real code path — including its availability probe — runs
 * unchanged under test.
 */
class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.failWrites) throw new DOMException("QuotaExceededError");
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  failWrites = false;
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported after the shim exists.
const { addEntry, buildExport, deleteEverything, getSnapshot, goToDate, hydrate, importFromCsv, removeEntry, setTargets, shiftDay, reloadFromStorage } =
  require("./store") as typeof import("./store");
const { KEYS } = require("./storage") as typeof import("./storage");
const { todayKey, addDays } = require("./date") as typeof import("./date");
const { totalsFor } = require("./schema") as typeof import("./schema");

const TARGETS = { calories: 2000, protein: 150, fibre: 30 } as const;

beforeEach(() => {
  memory.failWrites = false;
  deleteEverything();
  hydrate();
});

test("a fresh install has no targets, so the app can ask for them", () => {
  assert.equal(getSnapshot().settings, null);
  assert.equal(getSnapshot().loggedDays.length, 0);
});

test("targets are persisted, not just held in memory", () => {
  setTargets(TARGETS);
  assert.deepEqual(getSnapshot().settings?.targets, TARGETS);
  const raw = memory.getItem(KEYS.settings);
  assert.ok(raw);
  assert.deepEqual(JSON.parse(raw).targets, TARGETS);
});

test("adding an entry updates totals and records the day in the index", () => {
  setTargets(TARGETS);
  assert.equal(addEntry("calories", 450), "added");
  assert.equal(addEntry("protein", 30), "added");

  const state = getSnapshot();
  const totals = totalsFor(state.day);
  assert.equal(totals.calories, 450);
  assert.equal(totals.protein, 30);
  assert.deepEqual([...state.loggedDays], [todayKey()]);
});

test("an entry only ever writes its own day's key", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  const dayKeys = Array.from({ length: memory.length }, (_, i) => memory.key(i)).filter(
    (k): k is string => k !== null && k.includes(".day."),
  );
  assert.deepEqual(dayKeys, [KEYS.day(todayKey())]);
});

test("invalid amounts are rejected before they reach storage", () => {
  setTargets(TARGETS);
  assert.equal(addEntry("calories", -5), "invalid");
  assert.equal(addEntry("calories", 0), "invalid");
  assert.equal(addEntry("calories", NaN), "invalid");
  assert.equal(addEntry("calories", 99_999), "invalid");
  assert.equal(addEntry("calories", "abc"), "invalid");
  assert.equal(getSnapshot().day.entries.length, 0);
});

test("removing an entry removes exactly that entry", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  addEntry("calories", 200);
  const [first] = getSnapshot().day.entries;
  assert.ok(first);

  removeEntry(first.id);
  const entries = getSnapshot().day.entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.amount, 200);
});

test("removing an unknown id is a no-op", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  removeEntry("does-not-exist");
  assert.equal(getSnapshot().day.entries.length, 1);
});

test("days are isolated from each other", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);

  shiftDay(-1);
  assert.equal(getSnapshot().day.entries.length, 0, "yesterday starts empty");
  addEntry("calories", 100);
  assert.equal(totalsFor(getSnapshot().day).calories, 100);

  shiftDay(1);
  assert.equal(totalsFor(getSnapshot().day).calories, 450, "today is unchanged");
  assert.equal(getSnapshot().loggedDays.length, 2);
});

test("the view cannot be moved into the future", () => {
  setTargets(TARGETS);
  const today = todayKey();
  goToDate(addDays(today, 5));
  assert.equal(getSnapshot().viewDate, today);
  shiftDay(1);
  assert.equal(getSnapshot().viewDate, today);
});

test("back-filling a past day works and is kept separate", () => {
  setTargets(TARGETS);
  const yesterday = addDays(todayKey(), -1);
  goToDate(yesterday);
  addEntry("fibre", 12);
  assert.equal(getSnapshot().viewDate, yesterday);
  assert.equal(totalsFor(getSnapshot().day).fibre, 12);
});

test("a failed write surfaces instead of pretending to have saved", () => {
  setTargets(TARGETS);
  memory.failWrites = true;
  addEntry("calories", 450);
  assert.equal(getSnapshot().writeFailed, true);
  // The entry still shows, so the user is not silently blocked mid-meal.
  assert.equal(getSnapshot().day.entries.length, 1);
});

test("a lost index is rebuilt from the day keys on disk", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  shiftDay(-1);
  addEntry("calories", 100);

  memory.removeItem(KEYS.index);
  reloadFromStorage();

  assert.equal(getSnapshot().loggedDays.length, 2, "history must not disappear with the index");
});

test("corrupt day data degrades to an empty day rather than crashing", () => {
  setTargets(TARGETS);
  memory.setItem(KEYS.day(todayKey()), "{not json");
  reloadFromStorage();
  assert.equal(getSnapshot().day.entries.length, 0);
});

test("export contains the targets and every logged day", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  shiftDay(-1);
  addEntry("protein", 40);

  const csv = buildExport();
  assert.match(csv, /^type,date,macro,amount,logged_at/);
  assert.match(csv, /target,,calories,2000,/);
  assert.equal(csv.split("\r\n").filter((l) => l.startsWith("entry,")).length, 2);
});

test("import replaces existing data rather than merging it", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  const backup = buildExport();

  addEntry("calories", 999);
  assert.equal(totalsFor(getSnapshot().day).calories, 1449);

  const report = importFromCsv(backup);
  assert.ok(report.ok);
  // Importing the same backup twice must not double the day's totals.
  assert.equal(totalsFor(getSnapshot().day).calories, 450);
});

test("import restores targets so a new device is usable immediately", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  const backup = buildExport();

  deleteEverything();
  assert.equal(getSnapshot().settings, null);

  const report = importFromCsv(backup);
  assert.ok(report.ok);
  assert.deepEqual(getSnapshot().settings?.targets, TARGETS);
  assert.equal(report.summary.entries, 1);
});

test("a rejected import leaves existing data untouched", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);

  const report = importFromCsv("nonsense,file\n1,2\n");
  assert.equal(report.ok, false);
  assert.equal(totalsFor(getSnapshot().day).calories, 450);
  assert.deepEqual(getSnapshot().settings?.targets, TARGETS);
});

test("delete removes every key the app owns", () => {
  setTargets(TARGETS);
  addEntry("calories", 450);
  shiftDay(-1);
  addEntry("protein", 40);
  memory.setItem("someone-elses-key", "keep me");

  deleteEverything();

  const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
  assert.deepEqual(remaining, ["someone-elses-key"]);
  assert.equal(getSnapshot().settings, null);
  assert.equal(getSnapshot().loggedDays.length, 0);
});
