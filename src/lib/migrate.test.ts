import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

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
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

const { migrateLegacy } = require("./migrate") as typeof import("./migrate");
const { KEYS } = require("./storage") as typeof import("./storage");
const { parseDayLog, parseSettings, totalsFor } =
  require("./schema") as typeof import("./schema");

/** Writes an install of the original fixed calories/protein/fibre schema. */
function seedLegacy(): void {
  memory.setItem(
    "mt.v1.settings",
    JSON.stringify({
      v: 1,
      targets: { calories: 2000, protein: 150, fibre: 30 },
      createdAt: 1_750_000_000_000,
    }),
  );
  memory.setItem("mt.v1.index", JSON.stringify({ v: 1, days: ["2026-08-01", "2026-08-02"] }));
  memory.setItem(
    "mt.v1.day.2026-08-01",
    JSON.stringify({
      v: 1,
      date: "2026-08-01",
      entries: [
        { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
        { id: "b", macro: "protein", amount: 30, at: 1_754_000_100_000 },
      ],
    }),
  );
  memory.setItem(
    "mt.v1.day.2026-08-02",
    JSON.stringify({
      v: 1,
      date: "2026-08-02",
      entries: [{ id: "c", macro: "fibre", amount: 12, at: 1_754_100_000_000 }],
    }),
  );
}

beforeEach(() => {
  memory.clear();
});

test("nothing to migrate returns null and writes nothing", () => {
  assert.equal(migrateLegacy(), null);
  assert.equal(memory.length, 0);
});

test("the three old macros become three ordinary trackers", () => {
  seedLegacy();
  const result = migrateLegacy();
  assert.ok(result);

  assert.deepEqual(
    result.settings.trackers.map((t) => [t.name, t.unit, t.target]),
    [
      ["Calories", "kcal", 2000],
      ["Protein", "g", 150],
      ["Fibre", "g", 30],
    ],
  );
  assert.equal(result.settings.createdAt, 1_750_000_000_000, "the original install date is kept");
});

test("every logged entry survives the migration", () => {
  seedLegacy();
  const result = migrateLegacy();
  assert.ok(result);
  assert.deepEqual(result.days, ["2026-08-01", "2026-08-02"]);

  const day = parseDayLog(JSON.parse(memory.getItem(KEYS.day("2026-08-01")) as string), "2026-08-01");
  assert.ok(day);
  const totals = totalsFor(day);
  assert.equal(totals.get("calories"), 450);
  assert.equal(totals.get("protein"), 30);
  assert.equal(day.entries[0]?.at, 1_754_000_000_000, "timestamps are preserved");
});

test("migrated data is readable through the current parsers", () => {
  seedLegacy();
  migrateLegacy();
  const settings = parseSettings(JSON.parse(memory.getItem(KEYS.settings) as string));
  assert.ok(settings);
  assert.equal(settings.trackers.length, 3);
});

test("the old keys are cleared once the new ones are written", () => {
  seedLegacy();
  migrateLegacy();
  const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
  assert.equal(
    remaining.some((k) => k?.startsWith("mt.v1.")),
    false,
  );
});

test("migrating twice is a no-op the second time", () => {
  seedLegacy();
  migrateLegacy();
  assert.equal(migrateLegacy(), null);
});

test("a lost legacy index is recovered by scanning the old day keys", () => {
  seedLegacy();
  memory.removeItem("mt.v1.index");
  const result = migrateLegacy();
  assert.ok(result);
  assert.deepEqual(result.days, ["2026-08-01", "2026-08-02"]);
});

test("legacy settings with no usable targets are discarded, not half-migrated", () => {
  memory.setItem("mt.v1.settings", JSON.stringify({ v: 1, targets: { calories: -1 } }));
  assert.equal(migrateLegacy(), null);
  assert.equal(memory.getItem("mt.v1.settings"), null, "and are not left to retry forever");
});

test("unreadable legacy entries are dropped without failing the migration", () => {
  seedLegacy();
  memory.setItem(
    "mt.v1.day.2026-08-01",
    JSON.stringify({
      v: 1,
      date: "2026-08-01",
      entries: [
        { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
        { id: "b", macro: "vitamins", amount: 10, at: 1_754_000_000_000 },
        { id: "c", macro: "protein", amount: -5, at: 1_754_000_000_000 },
      ],
    }),
  );

  const result = migrateLegacy();
  assert.ok(result);
  const day = parseDayLog(JSON.parse(memory.getItem(KEYS.day("2026-08-01")) as string), "2026-08-01");
  assert.equal(day?.entries.length, 1);
});
