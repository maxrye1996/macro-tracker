"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const csv_1 = require("./csv");
const trackers = [
    { id: "t-cal", name: "Calories", unit: "kcal", target: 2000, colour: "amber", archived: false },
    { id: "t-water", name: "Water", unit: "ml", target: 2500, colour: "cyan", archived: false },
    { id: "t-old", name: "Fibre", unit: "g", target: 30, colour: "green", archived: true },
];
const days = [
    {
        date: "2026-08-01",
        entries: [
            { id: "a", trackerId: "t-cal", amount: 450, at: Date.UTC(2026, 7, 1, 8, 30) },
            { id: "b", trackerId: "t-water", amount: 500.5, at: Date.UTC(2026, 7, 1, 8, 31) },
        ],
    },
    {
        date: "2026-08-02",
        entries: [{ id: "c", trackerId: "t-old", amount: 12, at: Date.UTC(2026, 7, 2, 12, 0) }],
    },
];
(0, node_test_1.test)("export then import round-trips trackers and every entry", () => {
    const result = (0, csv_1.parseCsv)((0, csv_1.exportCsv)(trackers, days));
    strict_1.default.ok(result.ok, result.ok ? "" : result.error);
    strict_1.default.deepEqual([...result.value.trackers], trackers);
    strict_1.default.equal(result.value.imported, 3);
    strict_1.default.equal(result.value.skipped, 0);
    strict_1.default.equal(result.value.days.length, 2);
    const first = result.value.days[0];
    strict_1.default.equal(first?.entries[0]?.amount, 450);
    strict_1.default.equal(first?.entries[1]?.amount, 500.5);
    strict_1.default.equal(first?.entries[0]?.at, Date.UTC(2026, 7, 1, 8, 30));
});
(0, node_test_1.test)("the archived flag survives a round trip", () => {
    const result = (0, csv_1.parseCsv)((0, csv_1.exportCsv)(trackers, days));
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.trackers.find((t) => t.id === "t-old")?.archived, true);
    strict_1.default.equal(result.value.trackers.find((t) => t.id === "t-cal")?.archived, false);
});
(0, node_test_1.test)("entries belonging to an archived tracker are still exported", () => {
    const csv = (0, csv_1.exportCsv)(trackers, days);
    strict_1.default.ok(csv.includes("entry,2026-08-02,t-old,Fibre,g,12,"));
});
(0, node_test_1.test)("export is stable, so an unchanged log produces an identical file", () => {
    strict_1.default.equal((0, csv_1.exportCsv)(trackers, days), (0, csv_1.exportCsv)(trackers, [...days].reverse()));
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
    const csv = (0, csv_1.exportCsv)(trackers, days).replace(/\r\n/g, "\n");
    const result = (0, csv_1.parseCsv)(`﻿${csv}`);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 3);
});
(0, node_test_1.test)("entries referencing an unknown tracker are skipped, not silently attached", () => {
    const csv = [
        "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
        "tracker,,t-cal,Calories,kcal,2000,,amber,false",
        "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
        "entry,2026-08-01,t-ghost,Ghost,g,10,,,",
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 1);
    strict_1.default.equal(result.value.skipped, 1);
});
(0, node_test_1.test)("an entry matches by name when its tracker id is missing", () => {
    // Hand-edited files are a legitimate way to bulk-enter data.
    const csv = [
        "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
        "tracker,,t-cal,Calories,kcal,2000,,amber,false",
        "entry,2026-08-01,,calories,kcal,450,,,",
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 1);
    strict_1.default.equal(result.value.days[0]?.entries[0]?.trackerId, "t-cal");
});
(0, node_test_1.test)("tracker definitions are honoured wherever they appear in the file", () => {
    const csv = [
        "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
        "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
        "tracker,,t-cal,Calories,kcal,2000,,amber,false",
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.imported, 1);
});
(0, node_test_1.test)("import skips unusable rows and reports the count rather than failing", () => {
    const csv = [
        "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
        "tracker,,t-cal,Calories,kcal,2000,,amber,false",
        "tracker,,t-bad,,g,30,,green,false", // no name
        "tracker,,t-bad2,Nope,g,0,,green,false", // no usable target
        "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
        "entry,2026-08-01,t-cal,Calories,kcal,-99,,,", // negative
        "entry,2026-02-31,t-cal,Calories,kcal,10,,,", // impossible date
        "entry,not-a-date,t-cal,Calories,kcal,10,,,",
        "nonsense,,,,,,,,",
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    strict_1.default.equal(result.value.trackers.length, 1);
    strict_1.default.equal(result.value.imported, 1);
    strict_1.default.equal(result.value.skipped, 6);
});
(0, node_test_1.test)("an entry with no timestamp is placed at midday on its own date", () => {
    const csv = [
        "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
        "tracker,,t-cal,Calories,kcal,2000,,amber,false",
        "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(result.ok);
    const at = result.value.days[0]?.entries[0]?.at;
    strict_1.default.ok(typeof at === "number" && Number.isFinite(at));
    strict_1.default.equal(new Date(at).getHours(), 12);
});
(0, node_test_1.test)("import refuses an implausibly large file", () => {
    const huge = `type,date,tracker_id,name,unit,amount,logged_at,colour,archived\n${"x".repeat(6 * 1024 * 1024)}`;
    const result = (0, csv_1.parseCsv)(huge);
    strict_1.default.equal(result.ok, false);
    if (!result.ok)
        strict_1.default.match(result.error, /too large/);
});
(0, node_test_1.test)("a tracker name that a spreadsheet would execute is neutralised on export", () => {
    // Names are free text, so this is a real path: type the name, export, open
    // the backup in Excel.
    const hostile = [
        {
            id: "t-x",
            name: "=1+1",
            unit: "@SUM",
            target: 10,
            colour: "amber",
            archived: false,
        },
    ];
    const csv = (0, csv_1.exportCsv)(hostile, []);
    const dataLine = csv.trim().split("\r\n")[1] ?? "";
    for (const field of dataLine.split(",")) {
        strict_1.default.ok(!/^[=+@]/.test(field), `field would execute in a spreadsheet: ${field}`);
    }
    // …and the prefix is stripped again on the way back in.
    const back = (0, csv_1.parseCsv)(csv);
    strict_1.default.ok(back.ok);
    strict_1.default.equal(back.value.trackers[0]?.name, "=1+1");
    strict_1.default.equal(back.value.trackers[0]?.unit, "@SUM");
});
(0, node_test_1.test)("a name containing a comma or a quote survives a round trip", () => {
    const awkward = [
        {
            id: "t-y",
            name: 'Salt, "added"',
            unit: "g",
            target: 6,
            colour: "slate",
            archived: false,
        },
    ];
    const back = (0, csv_1.parseCsv)((0, csv_1.exportCsv)(awkward, []));
    strict_1.default.ok(back.ok);
    strict_1.default.equal(back.value.trackers[0]?.name, 'Salt, "added"');
});
(0, node_test_1.test)("the original fixed-macro export format still imports", () => {
    // Someone who exported before trackers existed must not lose their backup.
    const legacy = [
        "type,date,macro,amount,logged_at",
        "target,,calories,2000,",
        "target,,protein,150,",
        "target,,fibre,30,",
        "entry,2026-08-01,calories,450,2026-08-01T08:30:00.000Z",
        "entry,2026-08-01,protein,30,",
        "entry,2026-08-01,vitamins,10,", // unknown macro
    ].join("\r\n");
    const result = (0, csv_1.parseCsv)(legacy);
    strict_1.default.ok(result.ok, result.ok ? "" : result.error);
    strict_1.default.equal(result.value.trackers.length, 3);
    strict_1.default.equal(result.value.trackers[0]?.name, "Calories");
    strict_1.default.equal(result.value.trackers[0]?.unit, "kcal");
    strict_1.default.equal(result.value.imported, 2);
    strict_1.default.equal(result.value.skipped, 1);
    strict_1.default.equal(result.value.days[0]?.entries[0]?.at, Date.UTC(2026, 7, 1, 8, 30));
});
