import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, formatDayLabel, isDayKey, msUntilNextLocalMidnight, toDayKey } from "./date";

test("isDayKey rejects malformed and calendar-impossible dates", () => {
  assert.equal(isDayKey("2026-08-02"), true);
  assert.equal(isDayKey("2024-02-29"), true, "2024 is a leap year");
  assert.equal(isDayKey("2026-02-29"), false, "2026 is not");
  assert.equal(isDayKey("2026-02-31"), false);
  assert.equal(isDayKey("2026-13-01"), false);
  assert.equal(isDayKey("2026-00-10"), false);
  assert.equal(isDayKey("2026-8-2"), false, "must be zero padded");
  assert.equal(isDayKey("2026-08-02T10:00"), false);
  assert.equal(isDayKey(""), false);
  assert.equal(isDayKey(20260802), false);
  assert.equal(isDayKey(null), false);
});

test("toDayKey uses the local date, not UTC", () => {
  // 23:30 local on the 2nd is still the 2nd, whatever UTC thinks.
  const late = new Date(2026, 7, 2, 23, 30, 0);
  assert.equal(toDayKey(late), "2026-08-02");
  const early = new Date(2026, 7, 2, 0, 15, 0);
  assert.equal(toDayKey(early), "2026-08-02");
});

test("addDays crosses month, year and leap-day boundaries", () => {
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2025-02-28", 1), "2025-03-01");
  assert.equal(addDays("2026-03-15", -14), "2026-03-01");
});

test("addDays survives a daylight-saving transition", () => {
  // In Europe/London the clocks go forward on 2026-03-29. Naively adding
  // 86,400,000 ms would land back on the same calendar day.
  const previous = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    assert.equal(addDays("2026-03-28", 1), "2026-03-29");
    assert.equal(addDays("2026-03-29", 1), "2026-03-30");
    assert.equal(addDays("2026-10-25", 1), "2026-10-26");
  } finally {
    process.env.TZ = previous;
  }
});

test("msUntilNextLocalMidnight lands on the next local midnight", () => {
  const now = new Date(2026, 7, 2, 22, 0, 0, 0);
  const ms = msUntilNextLocalMidnight(now);
  const then = new Date(now.getTime() + ms);
  assert.equal(toDayKey(then), "2026-08-03");
  assert.equal(then.getHours(), 0);
  assert.equal(then.getMinutes(), 0);
});

test("msUntilNextLocalMidnight never returns zero or negative", () => {
  const justBefore = new Date(2026, 7, 2, 23, 59, 59, 999);
  assert.ok(msUntilNextLocalMidnight(justBefore) >= 1_000);
});

test("formatDayLabel names today and yesterday", () => {
  assert.equal(formatDayLabel("2026-08-02", "2026-08-02"), "Today");
  assert.equal(formatDayLabel("2026-08-01", "2026-08-02"), "Yesterday");
  assert.notEqual(formatDayLabel("2026-07-30", "2026-08-02"), "Today");
});
