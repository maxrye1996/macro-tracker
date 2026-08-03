"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
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
        this.map.set(k, String(v));
    }
    removeItem(k) {
        this.map.delete(k);
    }
    clear() {
        this.map.clear();
    }
}
const memory = new MemoryStorage();
globalThis.window = { localStorage: memory };
const { migrateLegacy } = require("./migrate");
const { KEYS } = require("./storage");
const { parseDayLog, parseSettings, totalsFor } = require("./schema");
/** Writes an install of the original fixed calories/protein/fibre schema. */
function seedLegacy() {
    memory.setItem("mt.v1.settings", JSON.stringify({
        v: 1,
        targets: { calories: 2000, protein: 150, fibre: 30 },
        createdAt: 1_750_000_000_000,
    }));
    memory.setItem("mt.v1.index", JSON.stringify({ v: 1, days: ["2026-08-01", "2026-08-02"] }));
    memory.setItem("mt.v1.day.2026-08-01", JSON.stringify({
        v: 1,
        date: "2026-08-01",
        entries: [
            { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
            { id: "b", macro: "protein", amount: 30, at: 1_754_000_100_000 },
        ],
    }));
    memory.setItem("mt.v1.day.2026-08-02", JSON.stringify({
        v: 1,
        date: "2026-08-02",
        entries: [{ id: "c", macro: "fibre", amount: 12, at: 1_754_100_000_000 }],
    }));
}
(0, node_test_1.beforeEach)(() => {
    memory.clear();
});
(0, node_test_1.test)("nothing to migrate returns null and writes nothing", () => {
    strict_1.default.equal(migrateLegacy(), null);
    strict_1.default.equal(memory.length, 0);
});
(0, node_test_1.test)("the three old macros become three ordinary trackers", () => {
    seedLegacy();
    const result = migrateLegacy();
    strict_1.default.ok(result);
    strict_1.default.deepEqual(result.settings.trackers.map((t) => [t.name, t.unit, t.target]), [
        ["Calories", "kcal", 2000],
        ["Protein", "g", 150],
        ["Fibre", "g", 30],
    ]);
    strict_1.default.equal(result.settings.createdAt, 1_750_000_000_000, "the original install date is kept");
});
(0, node_test_1.test)("every logged entry survives the migration", () => {
    seedLegacy();
    const result = migrateLegacy();
    strict_1.default.ok(result);
    strict_1.default.deepEqual(result.days, ["2026-08-01", "2026-08-02"]);
    const day = parseDayLog(JSON.parse(memory.getItem(KEYS.day("2026-08-01"))), "2026-08-01");
    strict_1.default.ok(day);
    const totals = totalsFor(day);
    strict_1.default.equal(totals.get("calories"), 450);
    strict_1.default.equal(totals.get("protein"), 30);
    strict_1.default.equal(day.entries[0]?.at, 1_754_000_000_000, "timestamps are preserved");
});
(0, node_test_1.test)("migrated data is readable through the current parsers", () => {
    seedLegacy();
    migrateLegacy();
    const settings = parseSettings(JSON.parse(memory.getItem(KEYS.settings)));
    strict_1.default.ok(settings);
    strict_1.default.equal(settings.trackers.length, 3);
});
(0, node_test_1.test)("the old keys are cleared once the new ones are written", () => {
    seedLegacy();
    migrateLegacy();
    const remaining = Array.from({ length: memory.length }, (_, i) => memory.key(i));
    strict_1.default.equal(remaining.some((k) => k?.startsWith("mt.v1.")), false);
});
(0, node_test_1.test)("migrating twice is a no-op the second time", () => {
    seedLegacy();
    migrateLegacy();
    strict_1.default.equal(migrateLegacy(), null);
});
(0, node_test_1.test)("a lost legacy index is recovered by scanning the old day keys", () => {
    seedLegacy();
    memory.removeItem("mt.v1.index");
    const result = migrateLegacy();
    strict_1.default.ok(result);
    strict_1.default.deepEqual(result.days, ["2026-08-01", "2026-08-02"]);
});
(0, node_test_1.test)("legacy settings with no usable targets are discarded, not half-migrated", () => {
    memory.setItem("mt.v1.settings", JSON.stringify({ v: 1, targets: { calories: -1 } }));
    strict_1.default.equal(migrateLegacy(), null);
    strict_1.default.equal(memory.getItem("mt.v1.settings"), null, "and are not left to retry forever");
});
(0, node_test_1.test)("unreadable legacy entries are dropped without failing the migration", () => {
    seedLegacy();
    memory.setItem("mt.v1.day.2026-08-01", JSON.stringify({
        v: 1,
        date: "2026-08-01",
        entries: [
            { id: "a", macro: "calories", amount: 450, at: 1_754_000_000_000 },
            { id: "b", macro: "vitamins", amount: 10, at: 1_754_000_000_000 },
            { id: "c", macro: "protein", amount: -5, at: 1_754_000_000_000 },
        ],
    }));
    const result = migrateLegacy();
    strict_1.default.ok(result);
    const day = parseDayLog(JSON.parse(memory.getItem(KEYS.day("2026-08-01"))), "2026-08-01");
    strict_1.default.equal(day?.entries.length, 1);
});
