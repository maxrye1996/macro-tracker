"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const date_1 = require("./date");
(0, node_test_1.test)("isDayKey rejects malformed and calendar-impossible dates", () => {
    strict_1.default.equal((0, date_1.isDayKey)("2026-08-02"), true);
    strict_1.default.equal((0, date_1.isDayKey)("2024-02-29"), true, "2024 is a leap year");
    strict_1.default.equal((0, date_1.isDayKey)("2026-02-29"), false, "2026 is not");
    strict_1.default.equal((0, date_1.isDayKey)("2026-02-31"), false);
    strict_1.default.equal((0, date_1.isDayKey)("2026-13-01"), false);
    strict_1.default.equal((0, date_1.isDayKey)("2026-00-10"), false);
    strict_1.default.equal((0, date_1.isDayKey)("2026-8-2"), false, "must be zero padded");
    strict_1.default.equal((0, date_1.isDayKey)("2026-08-02T10:00"), false);
    strict_1.default.equal((0, date_1.isDayKey)(""), false);
    strict_1.default.equal((0, date_1.isDayKey)(20260802), false);
    strict_1.default.equal((0, date_1.isDayKey)(null), false);
});
(0, node_test_1.test)("toDayKey uses the local date, not UTC", () => {
    // 23:30 local on the 2nd is still the 2nd, whatever UTC thinks.
    const late = new Date(2026, 7, 2, 23, 30, 0);
    strict_1.default.equal((0, date_1.toDayKey)(late), "2026-08-02");
    const early = new Date(2026, 7, 2, 0, 15, 0);
    strict_1.default.equal((0, date_1.toDayKey)(early), "2026-08-02");
});
(0, node_test_1.test)("addDays crosses month, year and leap-day boundaries", () => {
    strict_1.default.equal((0, date_1.addDays)("2026-08-31", 1), "2026-09-01");
    strict_1.default.equal((0, date_1.addDays)("2026-01-01", -1), "2025-12-31");
    strict_1.default.equal((0, date_1.addDays)("2024-02-28", 1), "2024-02-29");
    strict_1.default.equal((0, date_1.addDays)("2025-02-28", 1), "2025-03-01");
    strict_1.default.equal((0, date_1.addDays)("2026-03-15", -14), "2026-03-01");
});
(0, node_test_1.test)("addDays survives a daylight-saving transition", () => {
    // In Europe/London the clocks go forward on 2026-03-29. Naively adding
    // 86,400,000 ms would land back on the same calendar day.
    const previous = process.env.TZ;
    process.env.TZ = "Europe/London";
    try {
        strict_1.default.equal((0, date_1.addDays)("2026-03-28", 1), "2026-03-29");
        strict_1.default.equal((0, date_1.addDays)("2026-03-29", 1), "2026-03-30");
        strict_1.default.equal((0, date_1.addDays)("2026-10-25", 1), "2026-10-26");
    }
    finally {
        process.env.TZ = previous;
    }
});
(0, node_test_1.test)("msUntilNextLocalMidnight lands on the next local midnight", () => {
    const now = new Date(2026, 7, 2, 22, 0, 0, 0);
    const ms = (0, date_1.msUntilNextLocalMidnight)(now);
    const then = new Date(now.getTime() + ms);
    strict_1.default.equal((0, date_1.toDayKey)(then), "2026-08-03");
    strict_1.default.equal(then.getHours(), 0);
    strict_1.default.equal(then.getMinutes(), 0);
});
(0, node_test_1.test)("msUntilNextLocalMidnight never returns zero or negative", () => {
    const justBefore = new Date(2026, 7, 2, 23, 59, 59, 999);
    strict_1.default.ok((0, date_1.msUntilNextLocalMidnight)(justBefore) >= 1_000);
});
(0, node_test_1.test)("formatDayLabel names today and yesterday", () => {
    strict_1.default.equal((0, date_1.formatDayLabel)("2026-08-02", "2026-08-02"), "Today");
    strict_1.default.equal((0, date_1.formatDayLabel)("2026-08-01", "2026-08-02"), "Yesterday");
    strict_1.default.notEqual((0, date_1.formatDayLabel)("2026-07-30", "2026-08-02"), "Today");
});
