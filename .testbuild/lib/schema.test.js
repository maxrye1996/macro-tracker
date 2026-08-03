"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const schema_1 = require("./schema");
const trackers_1 = require("./trackers");
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
(0, node_test_1.test)("parseTracker accepts a well-formed tracker", () => {
    strict_1.default.deepEqual((0, schema_1.parseTracker)(validTracker), {
        id: "t1",
        name: "Calories",
        unit: "kcal",
        target: 2000,
        colour: "amber",
        archived: false,
    });
});
(0, node_test_1.test)("parseTracker rejects a tracker with no name or no usable target", () => {
    strict_1.default.equal((0, schema_1.parseTracker)({ ...validTracker, name: "   " }), null);
    strict_1.default.equal((0, schema_1.parseTracker)({ ...validTracker, name: 42 }), null);
    strict_1.default.equal((0, schema_1.parseTracker)({ ...validTracker, target: 0 }), null);
    strict_1.default.equal((0, schema_1.parseTracker)({ ...validTracker, target: "lots" }), null);
    strict_1.default.equal((0, schema_1.parseTracker)({ ...validTracker, id: "" }), null);
});
(0, node_test_1.test)("parseTracker falls back to a known colour rather than trusting the stored value", () => {
    // A colour is interpolated into a CSS custom property, so an unknown value
    // must never reach the stylesheet.
    const tracker = (0, schema_1.parseTracker)({ ...validTracker, colour: "url(javascript:alert(1))" });
    strict_1.default.equal(tracker?.colour, "blue");
});
(0, node_test_1.test)("parseTracker sanitises a hostile name on the way out of storage", () => {
    const tracker = (0, schema_1.parseTracker)({ ...validTracker, name: "Water\u202E ", unit: "m\u0000l" });
    strict_1.default.equal(tracker?.name, "Water");
    strict_1.default.equal(tracker?.unit, "ml");
});
(0, node_test_1.test)("parseTrackers drops bad entries, de-duplicates ids and caps the count", () => {
    const many = Array.from({ length: trackers_1.MAX_TRACKERS + 10 }, (_, i) => ({
        ...validTracker,
        id: `t${i}`,
    }));
    strict_1.default.equal((0, schema_1.parseTrackers)(many)?.length, trackers_1.MAX_TRACKERS);
    const mixed = (0, schema_1.parseTrackers)([
        validTracker,
        { ...validTracker, id: "t1", name: "Duplicate id" },
        { ...validTracker, id: "t2", name: "" },
        "not an object",
        null,
    ]);
    strict_1.default.equal(mixed?.length, 1);
    strict_1.default.equal(mixed?.[0]?.name, "Calories");
});
(0, node_test_1.test)("parseSettings refuses an unknown schema version", () => {
    const settings = { v: 2, trackers: [validTracker], createdAt: 1 };
    strict_1.default.ok((0, schema_1.parseSettings)(settings));
    strict_1.default.equal((0, schema_1.parseSettings)({ ...settings, v: 1 }), null);
    strict_1.default.equal((0, schema_1.parseSettings)({ ...settings, v: 3 }), null);
});
(0, node_test_1.test)("parseSettings falls back to a sane createdAt rather than an invalid date", () => {
    const settings = (0, schema_1.parseSettings)({ v: 2, trackers: [validTracker], createdAt: "yesterday" });
    strict_1.default.ok(settings);
    strict_1.default.ok(Number.isFinite(settings.createdAt) && settings.createdAt > 0);
});
(0, node_test_1.test)("settings round-trip through serialise and parse unchanged", () => {
    const parsed = (0, schema_1.parseSettings)({ v: 2, trackers: [validTracker], createdAt: 1_754_000_000_000 });
    strict_1.default.ok(parsed);
    strict_1.default.deepEqual((0, schema_1.parseSettings)((0, schema_1.serialiseSettings)(parsed)), parsed);
});
(0, node_test_1.test)("parseDayLog accepts well-formed data", () => {
    const day = (0, schema_1.parseDayLog)(validDay, "2026-08-02");
    strict_1.default.equal(day?.entries.length, 2);
});
(0, node_test_1.test)("parseDayLog refuses data written for a different day", () => {
    // A key/payload mismatch means something is corrupt; showing another day's
    // entries under today's date would be worse than showing nothing.
    strict_1.default.equal((0, schema_1.parseDayLog)(validDay, "2026-08-03"), null);
});
(0, node_test_1.test)("parseDayLog refuses an unknown schema version", () => {
    strict_1.default.equal((0, schema_1.parseDayLog)({ ...validDay, v: 1 }, "2026-08-02"), null);
    strict_1.default.equal((0, schema_1.parseDayLog)({ ...validDay, v: undefined }, "2026-08-02"), null);
});
(0, node_test_1.test)("parseDayLog drops individual bad entries instead of losing the whole day", () => {
    const day = (0, schema_1.parseDayLog)({
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
    }, "2026-08-02");
    strict_1.default.equal(day?.entries.length, 1);
    strict_1.default.equal(day?.entries[0]?.trackerId, "t1");
});
(0, node_test_1.test)("parseDayLog de-duplicates entry ids", () => {
    const day = (0, schema_1.parseDayLog)({
        v: 2,
        date: "2026-08-02",
        entries: [
            { id: "same", trackerId: "t1", amount: 100, at: 1 },
            { id: "same", trackerId: "t1", amount: 200, at: 2 },
        ],
    }, "2026-08-02");
    // Duplicate ids would make React keys collide and deletion ambiguous.
    strict_1.default.equal(day?.entries.length, 1);
});
(0, node_test_1.test)("parseDayLog caps the number of entries it will load", () => {
    const entries = Array.from({ length: schema_1.MAX_ENTRIES_PER_DAY + 50 }, (_, i) => ({
        id: `e${i}`,
        trackerId: "t1",
        amount: 1,
        at: 1_754_000_000_000,
    }));
    const day = (0, schema_1.parseDayLog)({ v: 2, date: "2026-08-02", entries }, "2026-08-02");
    strict_1.default.equal(day?.entries.length, schema_1.MAX_ENTRIES_PER_DAY);
});
(0, node_test_1.test)("parsing hostile JSON cannot pollute Object.prototype", () => {
    const hostile = JSON.parse('{"v":2,"date":"2026-08-02","entries":[],"trackers":[],"__proto__":{"polluted":true}}');
    (0, schema_1.parseDayLog)(hostile, "2026-08-02");
    (0, schema_1.parseSettings)(hostile);
    (0, schema_1.parseIndex)(hostile);
    strict_1.default.equal({}["polluted"], undefined);
});
(0, node_test_1.test)("parseIndex sorts, de-duplicates and discards invalid day keys", () => {
    const days = (0, schema_1.parseIndex)({
        v: 2,
        days: ["2026-08-03", "2026-08-01", "2026-08-03", "not-a-date", "2026-02-31", 42],
    });
    strict_1.default.deepEqual(days, ["2026-08-01", "2026-08-03"]);
});
(0, node_test_1.test)("totalsFor sums per tracker without float drift", () => {
    const day = {
        date: "2026-08-02",
        entries: [
            { id: "1", trackerId: "fibre", amount: 0.1, at: 1 },
            { id: "2", trackerId: "fibre", amount: 0.2, at: 2 },
            { id: "3", trackerId: "cal", amount: 450, at: 3 },
        ],
    };
    const totals = (0, schema_1.totalsFor)(day);
    strict_1.default.equal(totals.get("fibre"), 0.3, "must not surface 0.30000000000000004");
    strict_1.default.equal(totals.get("cal"), 450);
    strict_1.default.equal(totals.get("missing"), undefined);
});
(0, node_test_1.test)("totals are keyed in a Map, so a tracker id cannot collide with a prototype key", () => {
    const day = {
        date: "2026-08-02",
        entries: [{ id: "1", trackerId: "__proto__", amount: 5, at: 1 }],
    };
    const totals = (0, schema_1.totalsFor)(day);
    strict_1.default.equal(totals.get("__proto__"), 5);
    strict_1.default.equal({}["polluted"], undefined);
});
(0, node_test_1.test)("a day round-trips through serialise and parse unchanged", () => {
    const day = (0, schema_1.parseDayLog)(validDay, "2026-08-02");
    strict_1.default.ok(day);
    strict_1.default.deepEqual((0, schema_1.parseDayLog)((0, schema_1.serialiseDayLog)(day), "2026-08-02"), day);
});
