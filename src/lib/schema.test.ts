import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ENTRIES_PER_DAY,
  parseDayLog,
  parseIndex,
  parseSettings,
  parseTargets,
  serialiseDayLog,
  totalsFor,
  type DayLog,
} from "./schema";

const validDay = {
  v: 1,
  date: "2026-08-02",
  entries: [
    { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
    { id: "b", macro: "protein", amount: 30, at: 1_754_000_100_000 },
  ],
};

test("parseDayLog accepts well-formed data", () => {
  const day = parseDayLog(validDay, "2026-08-02");
  assert.ok(day);
  assert.equal(day.entries.length, 2);
});

test("parseDayLog refuses data written for a different day", () => {
  // A key/payload mismatch means something is corrupt; showing another day's
  // food under today's date would be worse than showing nothing.
  assert.equal(parseDayLog(validDay, "2026-08-03"), null);
});

test("parseDayLog refuses an unknown schema version", () => {
  assert.equal(parseDayLog({ ...validDay, v: 2 }, "2026-08-02"), null);
  assert.equal(parseDayLog({ ...validDay, v: undefined }, "2026-08-02"), null);
});

test("parseDayLog drops individual bad entries instead of losing the whole day", () => {
  const day = parseDayLog(
    {
      v: 1,
      date: "2026-08-02",
      entries: [
        { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
        { id: "b", macro: "vitamins", amount: 10, at: 1_754_000_000_000 },
        { id: "c", macro: "protein", amount: -5, at: 1_754_000_000_000 },
        { id: "d", macro: "protein", amount: 999_999, at: 1_754_000_000_000 },
        "not an object",
        null,
      ],
    },
    "2026-08-02",
  );
  assert.ok(day);
  assert.equal(day.entries.length, 1);
  assert.equal(day.entries[0]?.macro, "calories");
});

test("parseDayLog de-duplicates entry ids", () => {
  const day = parseDayLog(
    {
      v: 1,
      date: "2026-08-02",
      entries: [
        { id: "same", macro: "calories", amount: 100, at: 1 },
        { id: "same", macro: "calories", amount: 200, at: 2 },
      ],
    },
    "2026-08-02",
  );
  // Duplicate ids would make React keys collide and deletion ambiguous.
  assert.equal(day?.entries.length, 1);
});

test("parseDayLog caps the number of entries it will load", () => {
  const entries = Array.from({ length: MAX_ENTRIES_PER_DAY + 50 }, (_, i) => ({
    id: `e${i}`,
    macro: "calories",
    amount: 1,
    at: 1_754_000_000_000,
  }));
  const day = parseDayLog({ v: 1, date: "2026-08-02", entries }, "2026-08-02");
  assert.equal(day?.entries.length, MAX_ENTRIES_PER_DAY);
});

test("parsing hostile JSON cannot pollute Object.prototype", () => {
  const hostile = JSON.parse(
    '{"v":1,"date":"2026-08-02","entries":[],"__proto__":{"polluted":true}}',
  ) as unknown;
  parseDayLog(hostile, "2026-08-02");
  parseSettings(hostile);
  parseIndex(hostile);
  assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
});

test("parseTargets requires all three macros to be valid", () => {
  assert.deepEqual(parseTargets({ calories: 2000, protein: 150, fibre: 30 }), {
    calories: 2000,
    protein: 150,
    fibre: 30,
  });
  assert.equal(parseTargets({ calories: 2000, protein: 150 }), null);
  assert.equal(parseTargets({ calories: 0, protein: 150, fibre: 30 }), null);
  assert.equal(parseTargets(null), null);
  assert.equal(parseTargets([2000, 150, 30]), null);
});

test("parseSettings falls back to a sane createdAt rather than an invalid date", () => {
  const settings = parseSettings({
    v: 1,
    targets: { calories: 2000, protein: 150, fibre: 30 },
    createdAt: "yesterday",
  });
  assert.ok(settings);
  assert.ok(Number.isFinite(settings.createdAt));
  assert.ok(settings.createdAt > 0);
});

test("parseIndex sorts, de-duplicates and discards invalid day keys", () => {
  const days = parseIndex({
    v: 1,
    days: ["2026-08-03", "2026-08-01", "2026-08-03", "not-a-date", "2026-02-31", 42],
  });
  assert.deepEqual(days, ["2026-08-01", "2026-08-03"]);
});

test("totalsFor sums per macro without float drift", () => {
  const day: DayLog = {
    date: "2026-08-02",
    entries: [
      { id: "1", macro: "fibre", amount: 0.1, at: 1 },
      { id: "2", macro: "fibre", amount: 0.2, at: 2 },
      { id: "3", macro: "calories", amount: 450, at: 3 },
    ],
  };
  const totals = totalsFor(day);
  assert.equal(totals.fibre, 0.3, "must not surface 0.30000000000000004");
  assert.equal(totals.calories, 450);
  assert.equal(totals.protein, 0);
});

test("serialise then parse is a faithful round trip", () => {
  const day = parseDayLog(validDay, "2026-08-02");
  assert.ok(day);
  const again = parseDayLog(serialiseDayLog(day), "2026-08-02");
  assert.deepEqual(again, day);
});
