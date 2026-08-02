"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const schema_1 = require("./schema");
const validDay = {
    v: 1,
    date: "2026-08-02",
    entries: [
        { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
        { id: "b", macro: "protein", amount: 30, at: 1_754_000_100_000 },
    ],
};
(0, node_test_1.test)("parseDayLog accepts well-formed data", () => {
    const day = (0, schema_1.parseDayLog)(validDay, "2026-08-02");
    strict_1.default.ok(day);
    strict_1.default.equal(day.entries.length, 2);
});
(0, node_test_1.test)("parseDayLog refuses data written for a different day", () => {
    // A key/payload mismatch means something is corrupt; showing another day's
    // food under today's date would be worse than showing nothing.
    strict_1.default.equal((0, schema_1.parseDayLog)(validDay, "2026-08-03"), null);
});
(0, node_test_1.test)("parseDayLog refuses an unknown schema version", () => {
    strict_1.default.equal((0, schema_1.parseDayLog)({ ...validDay, v: 2 }, "2026-08-02"), null);
    strict_1.default.equal((0, schema_1.parseDayLog)({ ...validDay, v: undefined }, "2026-08-02"), null);
});
(0, node_test_1.test)("parseDayLog drops individual bad entries instead of losing the whole day", () => {
    const day = (0, schema_1.parseDayLog)({
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
    }, "2026-08-02");
    strict_1.default.ok(day);
    strict_1.default.equal(day.entries.length, 1);
    strict_1.default.equal(day.entries[0]?.macro, "calories");
});
(0, node_test_1.test)("parseDayLog de-duplicates entry ids", () => {
    const day = (0, schema_1.parseDayLog)({
        v: 1,
        date: "2026-08-02",
        entries: [
            { id: "same", macro: "calories", amount: 100, at: 1 },
            { id: "same", macro: "calories", amount: 200, at: 2 },
        ],
    }, "2026-08-02");
    // Duplicate ids would make React keys collide and deletion ambiguous.
    strict_1.default.equal(day?.entries.length, 1);
});
(0, node_test_1.test)("parseDayLog caps the number of entries it will load", () => {
    const entries = Array.from({ length: schema_1.MAX_ENTRIES_PER_DAY + 50 }, (_, i) => ({
        id: `e${i}`,
        macro: "calories",
        amount: 1,
        at: 1_754_000_000_000,
    }));
    const day = (0, schema_1.parseDayLog)({ v: 1, date: "2026-08-02", entries }, "2026-08-02");
    strict_1.default.equal(day?.entries.length, schema_1.MAX_ENTRIES_PER_DAY);
});
(0, node_test_1.test)("parsing hostile JSON cannot pollute Object.prototype", () => {
    const hostile = JSON.parse('{"v":1,"date":"2026-08-02","entries":[],"__proto__":{"polluted":true}}');
    (0, schema_1.parseDayLog)(hostile, "2026-08-02");
    (0, schema_1.parseSettings)(hostile);
    (0, schema_1.parseIndex)(hostile);
    strict_1.default.equal({}["polluted"], undefined);
});
(0, node_test_1.test)("parseTargets requires all three macros to be valid", () => {
    strict_1.default.deepEqual((0, schema_1.parseTargets)({ calories: 2000, protein: 150, fibre: 30 }), {
        calories: 2000,
        protein: 150,
        fibre: 30,
    });
    strict_1.default.equal((0, schema_1.parseTargets)({ calories: 2000, protein: 150 }), null);
    strict_1.default.equal((0, schema_1.parseTargets)({ calories: 0, protein: 150, fibre: 30 }), null);
    strict_1.default.equal((0, schema_1.parseTargets)(null), null);
    strict_1.default.equal((0, schema_1.parseTargets)([2000, 150, 30]), null);
});
(0, node_test_1.test)("parseSettings falls back to a sane createdAt rather than an invalid date", () => {
    const settings = (0, schema_1.parseSettings)({
        v: 1,
        targets: { calories: 2000, protein: 150, fibre: 30 },
        createdAt: "yesterday",
    });
    strict_1.default.ok(settings);
    strict_1.default.ok(Number.isFinite(settings.createdAt));
    strict_1.default.ok(settings.createdAt > 0);
});
(0, node_test_1.test)("parseIndex sorts, de-duplicates and discards invalid day keys", () => {
    const days = (0, schema_1.parseIndex)({
        v: 1,
        days: ["2026-08-03", "2026-08-01", "2026-08-03", "not-a-date", "2026-02-31", 42],
    });
    strict_1.default.deepEqual(days, ["2026-08-01", "2026-08-03"]);
});
(0, node_test_1.test)("totalsFor sums per macro without float drift", () => {
    const day = {
        date: "2026-08-02",
        entries: [
            { id: "1", macro: "fibre", amount: 0.1, at: 1 },
            { id: "2", macro: "fibre", amount: 0.2, at: 2 },
            { id: "3", macro: "calories", amount: 450, at: 3 },
        ],
    };
    const totals = (0, schema_1.totalsFor)(day);
    strict_1.default.equal(totals.fibre, 0.3, "must not surface 0.30000000000000004");
    strict_1.default.equal(totals.calories, 450);
    strict_1.default.equal(totals.protein, 0);
});
(0, node_test_1.test)("serialise then parse is a faithful round trip", () => {
    const day = (0, schema_1.parseDayLog)(validDay, "2026-08-02");
    strict_1.default.ok(day);
    const again = (0, schema_1.parseDayLog)((0, schema_1.serialiseDayLog)(day), "2026-08-02");
    strict_1.default.deepEqual(again, day);
});
