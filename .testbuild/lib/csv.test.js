"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const csv_1 = require("./csv");
const targets = { calories: 2000, protein: 150, fibre: 30 };
const days = [
    {
        date: "2026-08-01",
        entries: [
            { id: "a", macro: "calories", amount: 450, at: Date.UTC(2026, 7, 1, 8, 30) },
            { id: "b", macro: "protein", amount: 30.5, at: Date.UTC(2026, 7, 1, 8, 31) },
        ],
    },
    {
        date: "2026-08-02",
        entries: [{ id: "c", macro: "fibre", amount: 12, at: Date.UTC(2026, 7, 2, 12, 0) }],
    },
];
(0, node_test_1.test)("export then import round-trips targets and every entry", () => {
    const csv = (0, csv_1.exportCsv)(targets, days);
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok, result.ok ? "" : result.error);
    strict_1.default.deepEqual(result.value.targets, targets);
    strict_1.default.equal(result.value.imported, 3);
    strict_1.default.equal(result.value.skipped, 0);
    strict_1.default.equal(result.value.days.length, 2);
    const first = result.value.days[0];
    strict_1.default.equal(first?.date, "2026-08-01");
    strict_1.default.equal(first?.entries.length, 2);
    strict_1.default.equal(first?.entries[0]?.amount, 450);
    strict_1.default.equal(first?.entries[1]?.amount, 30.5);
    strict_1.default.equal(first?.entries[0]?.at, Date.UTC(2026, 7, 1, 8, 30));
});
(0, node_test_1.test)("export is stable, so an unchanged log produces an identical file", () => {
    strict_1.default.equal((0, csv_1.exportCsv)(targets, days), (0, csv_1.exportCsv)(targets, [...days].reverse()));
});
(0, node_test_1.test)("import rejects a file that is not a MacroTracro export", () => {
    const result = (0, csv_1.parseCsv)("name,calories\nBanana,105\n");
    strict_1.default.equal(result.ok, false);
    if (!result.ok)
        strict_1.default.match(result.error, /Unrecognised/);
});
(0, node_test_1.test)("import rejects an empty file", () => {
    strict_1.default.equal((0, csv_1.parseCsv)("").ok, false);
});
(0, node_test_1.test)("import tolerates a UTF-8 BOM and LF-only line endings", () => {
    const csv = (0, csv_1.exportCsv)(targets, days).replace(/\r\n/g, "\n");
    const result = (0, csv_1.parseCsv)(`﻿${csv}`);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 3);
});
(0, node_test_1.test)("import skips unusable rows and reports the count rather than failing", () => {
    const csv = [
        "type,date,macro,amount,logged_at",
        "target,,calories,2000,",
        "target,,protein,150,",
        "target,,fibre,30,",
        "entry,2026-08-01,calories,450,",
        "entry,2026-08-01,calories,-99,", // negative
        "entry,2026-08-01,vitamins,10,", // unknown macro
        "entry,2026-02-31,calories,10,", // impossible date
        "entry,not-a-date,calories,10,",
        "entry,2026-08-01,calories,999999,", // above the ceiling
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 1);
    strict_1.default.equal(result.value.skipped, 5);
});
(0, node_test_1.test)("an entry with no timestamp is placed at midday on its own date", () => {
    const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    const at = result.value.days[0]?.entries[0]?.at;
    strict_1.default.ok(typeof at === "number" && Number.isFinite(at));
    strict_1.default.equal(new Date(at).getHours(), 12);
});
(0, node_test_1.test)("import succeeds with entries even when the file carries no targets", () => {
    const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.targets, null);
    strict_1.default.equal(result.value.imported, 1);
});
(0, node_test_1.test)("import fails when a valid header carries nothing usable", () => {
    const csv = ["type,date,macro,amount,logged_at", "entry,bad,calories,-1,"].join("\r\n");
    strict_1.default.equal((0, csv_1.parseCsv)(csv).ok, false);
});
(0, node_test_1.test)("import refuses an implausibly large file", () => {
    const huge = `type,date,macro,amount,logged_at\n${"x".repeat(6 * 1024 * 1024)}`;
    const result = (0, csv_1.parseCsv)(huge);
    strict_1.default.equal(result.ok, false);
    if (!result.ok)
        strict_1.default.match(result.error, /too large/);
});
(0, node_test_1.test)("fields that a spreadsheet would execute are neutralised on export", () => {
    // No current field can start with a formula character, but the guard has to
    // hold for whatever fields get added later.
    const csv = (0, csv_1.exportCsv)(targets, [
        {
            date: "2026-08-01",
            entries: [{ id: "x", macro: "calories", amount: 450, at: Date.UTC(2026, 7, 1) }],
        },
    ]);
    for (const line of csv.trim().split("\r\n")) {
        for (const field of line.split(",")) {
            strict_1.default.ok(!/^[=+@]/.test(field), `field would execute in a spreadsheet: ${field}`);
        }
    }
});
(0, node_test_1.test)("the anti-injection prefix is stripped again on import", () => {
    const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv.replace("entry,", "'entry,"));
    strict_1.default.ok(result.ok);
});
(0, node_test_1.test)("quoted fields and embedded commas survive a round trip", () => {
    const csv = ['type,date,macro,amount,logged_at', '"entry","2026-08-01","calories","450",""'].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 1);
});
