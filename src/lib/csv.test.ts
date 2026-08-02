import assert from "node:assert/strict";
import { test } from "node:test";
import { exportCsv, parseCsv } from "./csv";
import type { DayLog, Targets } from "./schema";

const targets: Targets = { calories: 2000, protein: 150, fibre: 30 };

const days: DayLog[] = [
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

test("export then import round-trips targets and every entry", () => {
  const csv = exportCsv(targets, days);
  const result = parseCsv(csv);
  assert.ok(result.ok, result.ok ? "" : result.error);

  assert.deepEqual(result.value.targets, targets);
  assert.equal(result.value.imported, 3);
  assert.equal(result.value.skipped, 0);
  assert.equal(result.value.days.length, 2);

  const first = result.value.days[0];
  assert.equal(first?.date, "2026-08-01");
  assert.equal(first?.entries.length, 2);
  assert.equal(first?.entries[0]?.amount, 450);
  assert.equal(first?.entries[1]?.amount, 30.5);
  assert.equal(first?.entries[0]?.at, Date.UTC(2026, 7, 1, 8, 30));
});

test("export is stable, so an unchanged log produces an identical file", () => {
  assert.equal(exportCsv(targets, days), exportCsv(targets, [...days].reverse()));
});

test("import rejects a file that is not a MacroTracro export", () => {
  const result = parseCsv("name,calories\nBanana,105\n");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unrecognised/);
});

test("import rejects an empty file", () => {
  assert.equal(parseCsv("").ok, false);
});

test("import tolerates a UTF-8 BOM and LF-only line endings", () => {
  const csv = exportCsv(targets, days).replace(/\r\n/g, "\n");
  const result = parseCsv(`﻿${csv}`);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 3);
});

test("import skips unusable rows and reports the count rather than failing", () => {
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

  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 1);
  assert.equal(result.value.skipped, 5);
});

test("an entry with no timestamp is placed at midday on its own date", () => {
  const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
  const result = parseCsv(csv);
  assert.ok(result.ok);
  const at = result.value.days[0]?.entries[0]?.at;
  assert.ok(typeof at === "number" && Number.isFinite(at));
  assert.equal(new Date(at).getHours(), 12);
});

test("import succeeds with entries even when the file carries no targets", () => {
  const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.targets, null);
  assert.equal(result.value.imported, 1);
});

test("import fails when a valid header carries nothing usable", () => {
  const csv = ["type,date,macro,amount,logged_at", "entry,bad,calories,-1,"].join("\r\n");
  assert.equal(parseCsv(csv).ok, false);
});

test("import refuses an implausibly large file", () => {
  const huge = `type,date,macro,amount,logged_at\n${"x".repeat(6 * 1024 * 1024)}`;
  const result = parseCsv(huge);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /too large/);
});

test("fields that a spreadsheet would execute are neutralised on export", () => {
  // No current field can start with a formula character, but the guard has to
  // hold for whatever fields get added later.
  const csv = exportCsv(targets, [
    {
      date: "2026-08-01",
      entries: [{ id: "x", macro: "calories", amount: 450, at: Date.UTC(2026, 7, 1) }],
    },
  ]);
  for (const line of csv.trim().split("\r\n")) {
    for (const field of line.split(",")) {
      assert.ok(!/^[=+@]/.test(field), `field would execute in a spreadsheet: ${field}`);
    }
  }
});

test("the anti-injection prefix is stripped again on import", () => {
  const csv = ["type,date,macro,amount,logged_at", "entry,2026-08-01,calories,450,"].join("\r\n");
  const result = parseCsv(csv.replace("entry,", "'entry,"));
  assert.ok(result.ok);
});

test("quoted fields and embedded commas survive a round trip", () => {
  const csv = ['type,date,macro,amount,logged_at', '"entry","2026-08-01","calories","450",""'].join(
    "\r\n",
  );
  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 1);
});
