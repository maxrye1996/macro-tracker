import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ENTRIES_PER_DAY,
  parseDayLog,
  parseIndex,
  parseSettings,
  parseTracker,
  parseTrackers,
  serialiseDayLog,
  serialiseSettings,
  totalsFor,
  type DayLog,
} from "./schema";
import { MAX_TRACKERS } from "./trackers";

const validDay = {
  v: 2,
  date: "2026-08-02",
  entries: [
    { id: "a", trackerId: "t1", amount: 450, at: 1_754_000_000_000 },
    { id: "b", trackerId: "t2", amount: 30, at: 1_754_000_100_000 },
  ],
};

const validTracker = {
  id: "t1",
  name: "Calories",
  unit: "kcal",
  target: 2000,
  colour: "amber",
  archived: false,
};

test("parseTracker accepts a well-formed tracker", () => {
  assert.deepEqual(parseTracker(validTracker), {
    id: "t1",
    name: "Calories",
    unit: "kcal",
    target: 2000,
    colour: "amber",
    // Absent from the input, so it defaults to a limit — the backwards-compat
    // guarantee for trackers stored before goals existed.
    direction: "limit",
    archived: false,
  });
});

test("parseTracker keeps a stored goal direction and rejects an unknown one", () => {
  assert.equal(parseTracker({ ...validTracker, direction: "goal" })?.direction, "goal");
  assert.equal(parseTracker({ ...validTracker, direction: "sideways" })?.direction, "limit");
});

test("parseTracker rejects a tracker with no name or no usable target", () => {
  assert.equal(parseTracker({ ...validTracker, name: "   " }), null);
  assert.equal(parseTracker({ ...validTracker, name: 42 }), null);
  assert.equal(parseTracker({ ...validTracker, target: 0 }), null);
  assert.equal(parseTracker({ ...validTracker, target: "lots" }), null);
  assert.equal(parseTracker({ ...validTracker, id: "" }), null);
});

test("parseTracker falls back to a known colour rather than trusting the stored value", () => {
  // A colour is interpolated into a CSS custom property, so an unknown value
  // must never reach the stylesheet.
  const tracker = parseTracker({ ...validTracker, colour: "url(javascript:alert(1))" });
  assert.equal(tracker?.colour, "blue");
});

test("parseTracker sanitises a hostile name on the way out of storage", () => {
  const tracker = parseTracker({ ...validTracker, name: "Water\u202E ", unit: "m\u0000l" });
  assert.equal(tracker?.name, "Water");
  assert.equal(tracker?.unit, "ml");
});

test("parseTrackers drops bad entries, de-duplicates ids and caps the count", () => {
  const many = Array.from({ length: MAX_TRACKERS + 10 }, (_, i) => ({
    ...validTracker,
    id: `t${i}`,
  }));
  assert.equal(parseTrackers(many)?.length, MAX_TRACKERS);

  const mixed = parseTrackers([
    validTracker,
    { ...validTracker, id: "t1", name: "Duplicate id" },
    { ...validTracker, id: "t2", name: "" },
    "not an object",
    null,
  ]);
  assert.equal(mixed?.length, 1);
  assert.equal(mixed?.[0]?.name, "Calories");
});

test("parseSettings refuses an unknown schema version", () => {
  const settings = { v: 2, trackers: [validTracker], createdAt: 1 };
  assert.ok(parseSettings(settings));
  assert.equal(parseSettings({ ...settings, v: 1 }), null);
  assert.equal(parseSettings({ ...settings, v: 3 }), null);
});

test("parseSettings falls back to a sane createdAt rather than an invalid date", () => {
  const settings = parseSettings({ v: 2, trackers: [validTracker], createdAt: "yesterday" });
  assert.ok(settings);
  assert.ok(Number.isFinite(settings.createdAt) && settings.createdAt > 0);
});

test("settings round-trip through serialise and parse unchanged", () => {
  const parsed = parseSettings({ v: 2, trackers: [validTracker], createdAt: 1_754_000_000_000 });
  assert.ok(parsed);
  assert.deepEqual(parseSettings(serialiseSettings(parsed)), parsed);
});

test("parseDayLog accepts well-formed data", () => {
  const day = parseDayLog(validDay, "2026-08-02");
  assert.equal(day?.entries.length, 2);
});

test("parseDayLog refuses data written for a different day", () => {
  // A key/payload mismatch means something is corrupt; showing another day's
  // entries under today's date would be worse than showing nothing.
  assert.equal(parseDayLog(validDay, "2026-08-03"), null);
});

test("parseDayLog refuses an unknown schema version", () => {
  assert.equal(parseDayLog({ ...validDay, v: 1 }, "2026-08-02"), null);
  assert.equal(parseDayLog({ ...validDay, v: undefined }, "2026-08-02"), null);
});

test("parseDayLog drops individual bad entries instead of losing the whole day", () => {
  const day = parseDayLog(
    {
      v: 2,
      date: "2026-08-02",
      entries: [
        { id: "a", trackerId: "t1", amount: 450, at: 1_754_000_000_000 },
        { id: "b", amount: 10, at: 1_754_000_000_000 },
        { id: "c", trackerId: "t1", amount: -5, at: 1_754_000_000_000 },
        { id: "d", trackerId: "t1", amount: 9_999_999, at: 1_754_000_000_000 },
        "not an object",
        null,
      ],
    },
    "2026-08-02",
  );
  assert.equal(day?.entries.length, 1);
  assert.equal(day?.entries[0]?.trackerId, "t1");
});

test("parseDayLog de-duplicates entry ids", () => {
  const day = parseDayLog(
    {
      v: 2,
      date: "2026-08-02",
      entries: [
        { id: "same", trackerId: "t1", amount: 100, at: 1 },
        { id: "same", trackerId: "t1", amount: 200, at: 2 },
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
    trackerId: "t1",
    amount: 1,
    at: 1_754_000_000_000,
  }));
  const day = parseDayLog({ v: 2, date: "2026-08-02", entries }, "2026-08-02");
  assert.equal(day?.entries.length, MAX_ENTRIES_PER_DAY);
});

test("parsing hostile JSON cannot pollute Object.prototype", () => {
  const hostile = JSON.parse(
    '{"v":2,"date":"2026-08-02","entries":[],"trackers":[],"__proto__":{"polluted":true}}',
  ) as unknown;
  parseDayLog(hostile, "2026-08-02");
  parseSettings(hostile);
  parseIndex(hostile);
  assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
});

test("parseIndex sorts, de-duplicates and discards invalid day keys", () => {
  const days = parseIndex({
    v: 2,
    days: ["2026-08-03", "2026-08-01", "2026-08-03", "not-a-date", "2026-02-31", 42],
  });
  assert.deepEqual(days, ["2026-08-01", "2026-08-03"]);
});

test("totalsFor sums per tracker without float drift", () => {
  const day: DayLog = {
    date: "2026-08-02",
    entries: [
      { id: "1", trackerId: "fibre", amount: 0.1, at: 1 },
      { id: "2", trackerId: "fibre", amount: 0.2, at: 2 },
      { id: "3", trackerId: "cal", amount: 450, at: 3 },
    ],
  };
  const totals = totalsFor(day);
  assert.equal(totals.get("fibre"), 0.3, "must not surface 0.30000000000000004");
  assert.equal(totals.get("cal"), 450);
  assert.equal(totals.get("missing"), undefined);
});

test("totals are keyed in a Map, so a tracker id cannot collide with a prototype key", () => {
  const day: DayLog = {
    date: "2026-08-02",
    entries: [{ id: "1", trackerId: "__proto__", amount: 5, at: 1 }],
  };
  const totals = totalsFor(day);
  assert.equal(totals.get("__proto__"), 5);
  assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
});

test("a day round-trips through serialise and parse unchanged", () => {
  const day = parseDayLog(validDay, "2026-08-02");
  assert.ok(day);
  assert.deepEqual(parseDayLog(serialiseDayLog(day), "2026-08-02"), day);
});
