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
const store = require("./store") as typeof import("./store");
const {
  addEntry,
  addTracker,
  buildExport,
  countEntries,
  deleteEverything,
  getSnapshot,
  goToDate,
  hydrate,
  importFromCsv,
  moveTracker,
  reloadFromStorage,
  removeEntry,
  removeTracker,
  restoreTracker,
  setTrackers,
  shiftDay,
  updateTracker,
} = store;
const { KEYS } = require("./storage") as typeof import("./storage");
const { todayKey, addDays } = require("./date") as typeof import("./date");
const { totalsFor } = require("./schema") as typeof import("./schema");
const { MAX_TRACKERS } = require("./trackers") as typeof import("./trackers");

function trackerIdByName(name: string): string {
  const tracker = getSnapshot().settings?.trackers.find((t) => t.name === name);
  assert.ok(tracker, `no tracker named ${name}`);
  return tracker.id;
}

function totalFor(name: string): number {
  return totalsFor(getSnapshot().day).get(trackerIdByName(name)) ?? 0;
}

/** Two trackers is enough to prove per-tracker isolation. */
function seed(): void {
  assert.equal(addTracker({ name: "Calories", unit: "kcal", target: 2000 }), "added");
  assert.equal(addTracker({ name: "Water", unit: "ml", target: 2500 }), "added");
}

beforeEach(() => {
  memory.failWrites = false;
  deleteEverything();
  hydrate();
});

test("a fresh install has no trackers, so the app asks for them", () => {
  assert.equal(getSnapshot().settings, null);
  assert.equal(getSnapshot().loggedDays.length, 0);
});

test("trackers are persisted, not just held in memory", () => {
  seed();
  const raw = memory.getItem(KEYS.settings);
  assert.ok(raw);
  const parsed = JSON.parse(raw) as { trackers: { name: string }[] };
  assert.deepEqual(
    parsed.trackers.map((t) => t.name),
    ["Calories", "Water"],
  );
});

test("a tracker with no name or no usable target is rejected", () => {
  assert.equal(addTracker({ name: "  ", unit: "g", target: 10 }), "invalid");
  assert.equal(addTracker({ name: "Salt", unit: "g", target: 0 }), "invalid");
  assert.equal(addTracker({ name: "Salt", unit: "g", target: "loads" }), "invalid");
  assert.equal(getSnapshot().settings, null);
});

test("new trackers are given distinct colours", () => {
  seed();
  const colours = getSnapshot().settings?.trackers.map((t) => t.colour) ?? [];
  assert.equal(new Set(colours).size, colours.length);
});

test("the number of trackers is capped", () => {
  for (let i = 0; i < MAX_TRACKERS; i += 1) {
    assert.equal(addTracker({ name: `T${i}`, unit: "", target: 10 }), "added");
  }
  assert.equal(addTracker({ name: "One too many", unit: "", target: 10 }), "full");
  assert.equal(getSnapshot().settings?.trackers.length, MAX_TRACKERS);
});

test("editing a tracker keeps its id, so existing entries stay attached", () => {
  seed();
  const id = trackerIdByName("Water");
  addEntry(id, 500);

  assert.equal(updateTracker(id, { name: "Hydration", target: 3000 }), "added");
  assert.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.name, "Hydration");
  assert.equal(totalFor("Hydration"), 500);
});

test("an invalid edit is refused and leaves the stored tracker alone", () => {
  seed();
  const id = trackerIdByName("Water");
  assert.equal(updateTracker(id, { name: "   " }), "invalid");
  assert.equal(updateTracker(id, { target: -1 }), "invalid");
  assert.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.name, "Water");
});

test("adding an entry updates that tracker's total only", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);
  assert.equal(totalFor("Calories"), 450);
  assert.equal(totalFor("Water"), 0);
  assert.deepEqual([...getSnapshot().loggedDays], [todayKey()]);
});

test("an entry only ever writes its own day's key", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);
  const dayKeys = Array.from({ length: memory.length }, (_, i) => memory.key(i)).filter(
    (k): k is string => k !== null && k.includes(".day."),
  );
  assert.deepEqual(dayKeys, [KEYS.day(todayKey())]);
});

test("invalid amounts are rejected before they reach storage", () => {
  seed();
  const id = trackerIdByName("Calories");
  for (const bad of [-5, 0, NaN, 9_999_999, "abc"]) {
    assert.equal(addEntry(id, bad), "invalid", `expected ${String(bad)} to be rejected`);
  }
  assert.equal(getSnapshot().day.entries.length, 0);
});

test("an entry for an unknown tracker is refused", () => {
  seed();
  // Otherwise a stale id could write a row nothing can ever display or delete.
  assert.equal(addEntry("no-such-tracker", 100), "invalid");
  assert.equal(getSnapshot().day.entries.length, 0);
});

test("removing an entry removes exactly that entry", () => {
  seed();
  const id = trackerIdByName("Calories");
  addEntry(id, 450);
  addEntry(id, 200);
  const [first] = getSnapshot().day.entries;
  assert.ok(first);

  removeEntry(first.id);
  assert.equal(getSnapshot().day.entries.length, 1);
  assert.equal(getSnapshot().day.entries[0]?.amount, 200);
});

test("removing a tracker with history archives it and keeps every entry", () => {
  seed();
  const id = trackerIdByName("Water");
  addEntry(id, 500);

  assert.equal(removeTracker(id), "archived");
  const tracker = getSnapshot().settings?.trackers.find((t) => t.id === id);
  assert.equal(tracker?.archived, true, "the tracker itself is kept");
  assert.equal(countEntries(id), 1, "its entries are kept");
  assert.equal(getSnapshot().day.entries.length, 1);
});

test("removing a tracker that was never used deletes it outright", () => {
  seed();
  const id = trackerIdByName("Water");
  assert.equal(removeTracker(id), "deleted");
  assert.equal(
    getSnapshot().settings?.trackers.some((t) => t.id === id),
    false,
    "nothing to preserve, so nothing is left behind",
  );
});

test("an archived tracker can be restored with its history intact", () => {
  seed();
  const id = trackerIdByName("Water");
  addEntry(id, 500);
  removeTracker(id);

  restoreTracker(id);
  assert.equal(getSnapshot().settings?.trackers.find((t) => t.id === id)?.archived, false);
  assert.equal(totalFor("Water"), 500);
});

test("removing an unknown tracker is a no-op", () => {
  seed();
  assert.equal(removeTracker("nope"), "unknown");
  assert.equal(getSnapshot().settings?.trackers.length, 2);
});

test("trackers can be reordered, and moves past either end do nothing", () => {
  seed();
  const water = trackerIdByName("Water");

  moveTracker(water, -1);
  assert.deepEqual(
    getSnapshot().settings?.trackers.map((t) => t.name),
    ["Water", "Calories"],
  );

  moveTracker(water, -1);
  assert.deepEqual(
    getSnapshot().settings?.trackers.map((t) => t.name),
    ["Water", "Calories"],
    "already first",
  );
});

test("setTrackers replaces the whole list, as first-run setup does", () => {
  setTrackers([
    { id: "a", name: "Steps", unit: "", target: 8000, colour: "lime", archived: false },
  ]);
  assert.equal(getSnapshot().settings?.trackers.length, 1);
  assert.equal(getSnapshot().settings?.trackers[0]?.name, "Steps");
});

test("days are isolated from each other", () => {
  seed();
  const id = trackerIdByName("Calories");
  addEntry(id, 450);

  shiftDay(-1);
  assert.equal(getSnapshot().day.entries.length, 0, "yesterday starts empty");
  addEntry(id, 100);
  assert.equal(totalFor("Calories"), 100);

  shiftDay(1);
  assert.equal(totalFor("Calories"), 450, "today is unchanged");
  assert.equal(getSnapshot().loggedDays.length, 2);
});

test("the view cannot be moved into the future", () => {
  seed();
  const today = todayKey();
  goToDate(addDays(today, 5));
  assert.equal(getSnapshot().viewDate, today);
  shiftDay(1);
  assert.equal(getSnapshot().viewDate, today);
});

test("a failed write surfaces instead of pretending to have saved", () => {
  seed();
  memory.failWrites = true;
  addEntry(trackerIdByName("Calories"), 450);
  assert.equal(getSnapshot().writeFailed, true);
  // The entry still shows, so the user is not silently blocked mid-meal.
  assert.equal(getSnapshot().day.entries.length, 1);
});

test("a lost index is rebuilt from the day keys on disk", () => {
  seed();
  const id = trackerIdByName("Calories");
  addEntry(id, 450);
  shiftDay(-1);
  addEntry(id, 100);

  memory.removeItem(KEYS.index);
  reloadFromStorage();

  assert.equal(getSnapshot().loggedDays.length, 2, "history must not disappear with the index");
});

test("corrupt day data degrades to an empty day rather than crashing", () => {
  seed();
  memory.setItem(KEYS.day(todayKey()), "{not json");
  reloadFromStorage();
  assert.equal(getSnapshot().day.entries.length, 0);
});

test("export contains every tracker and every logged day", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);
  shiftDay(-1);
  addEntry(trackerIdByName("Water"), 500);

  const csv = buildExport();
  assert.match(csv, /^type,date,tracker_id,name,unit,amount,logged_at,colour,archived/);
  assert.equal(csv.split("\r\n").filter((l) => l.startsWith("tracker,")).length, 2);
  assert.equal(csv.split("\r\n").filter((l) => l.startsWith("entry,")).length, 2);
});

test("import replaces existing data rather than merging it", () => {
  seed();
  const id = trackerIdByName("Calories");
  addEntry(id, 450);
  const backup = buildExport();

  addEntry(id, 999);
  assert.equal(totalFor("Calories"), 1449);

  assert.ok(importFromCsv(backup).ok);
  // Importing the same backup twice must not double the day's totals.
  assert.equal(totalFor("Calories"), 450);
});

test("import restores trackers so a new device is usable immediately", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);
  const backup = buildExport();

  deleteEverything();
  assert.equal(getSnapshot().settings, null);

  const report = importFromCsv(backup);
  assert.ok(report.ok);
  assert.equal(report.summary.trackers, 2);
  assert.equal(report.summary.entries, 1);
  assert.equal(totalFor("Calories"), 450);
});

test("a rejected import leaves existing data untouched", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);

  assert.equal(importFromCsv("nonsense,file\n1,2\n").ok, false);
  assert.equal(totalFor("Calories"), 450);
  assert.equal(getSnapshot().settings?.trackers.length, 2);
});

test("delete removes every key the app owns and nothing else", () => {
  seed();
  addEntry(trackerIdByName("Calories"), 450);
  shiftDay(-1);
  addEntry(trackerIdByName("Water"), 500);
  memory.setItem("someone-elses-key", "keep me");

  deleteEverything();

  const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
  assert.deepEqual(remaining, ["someone-elses-key"]);
  assert.equal(getSnapshot().settings, null);
  assert.equal(getSnapshot().loggedDays.length, 0);
});
