import assert from "node:assert/strict";
import { test } from "node:test";
import { exportCsv, parseCsv } from "./csv";
import type { DayLog } from "./schema";
import type { Tracker } from "./trackers";

const trackers: Tracker[] = [
  { id: "t-cal", name: "Calories", unit: "kcal", target: 2000, colour: "amber", direction: "limit", archived: false },
  { id: "t-water", name: "Water", unit: "ml", target: 2500, colour: "cyan", direction: "goal", archived: false },
  { id: "t-old", name: "Fibre", unit: "g", target: 30, colour: "green", direction: "limit", archived: true },
];

const days: DayLog[] = [
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

test("export then import round-trips trackers and every entry", () => {
  const result = parseCsv(exportCsv(trackers, days));
  assert.ok(result.ok, result.ok ? "" : result.error);

  assert.deepEqual([...result.value.trackers], trackers);
  assert.equal(result.value.imported, 3);
  assert.equal(result.value.skipped, 0);
  assert.equal(result.value.days.length, 2);

  const first = result.value.days[0];
  assert.equal(first?.entries[0]?.amount, 450);
  assert.equal(first?.entries[1]?.amount, 500.5);
  assert.equal(first?.entries[0]?.at, Date.UTC(2026, 7, 1, 8, 30));
});

test("the archived flag survives a round trip", () => {
  const result = parseCsv(exportCsv(trackers, days));
  assert.ok(result.ok);
  assert.equal(result.value.trackers.find((t) => t.id === "t-old")?.archived, true);
  assert.equal(result.value.trackers.find((t) => t.id === "t-cal")?.archived, false);
});

test("entries belonging to an archived tracker are still exported", () => {
  const csv = exportCsv(trackers, days);
  assert.ok(csv.includes("entry,2026-08-02,t-old,Fibre,g,12,"));
});

test("export is stable, so an unchanged log produces an identical file", () => {
  assert.equal(exportCsv(trackers, days), exportCsv(trackers, [...days].reverse()));
});

test("import rejects a file that is not a TrackRyte export", () => {
  const result = parseCsv("name,calories\nBanana,105\n");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unrecognised/);
});

test("import rejects an empty file", () => {
  assert.equal(parseCsv("").ok, false);
});

test("import tolerates a UTF-8 BOM and LF-only line endings", () => {
  const csv = exportCsv(trackers, days).replace(/\r\n/g, "\n");
  const result = parseCsv(`﻿${csv}`);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 3);
});

test("entries referencing an unknown tracker are skipped, not silently attached", () => {
  const csv = [
    "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
    "tracker,,t-cal,Calories,kcal,2000,,amber,false",
    "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
    "entry,2026-08-01,t-ghost,Ghost,g,10,,,",
  ].join("\r\n");

  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 1);
  assert.equal(result.value.skipped, 1);
});

test("an entry matches by name when its tracker id is missing", () => {
  // Hand-edited files are a legitimate way to bulk-enter data.
  const csv = [
    "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
    "tracker,,t-cal,Calories,kcal,2000,,amber,false",
    "entry,2026-08-01,,calories,kcal,450,,,",
  ].join("\r\n");

  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 1);
  assert.equal(result.value.days[0]?.entries[0]?.trackerId, "t-cal");
});

test("tracker definitions are honoured wherever they appear in the file", () => {
  const csv = [
    "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
    "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
    "tracker,,t-cal,Calories,kcal,2000,,amber,false",
  ].join("\r\n");

  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.imported, 1);
});

test("import skips unusable rows and reports the count rather than failing", () => {
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

  const result = parseCsv(csv);
  assert.ok(result.ok);
  assert.equal(result.value.trackers.length, 1);
  assert.equal(result.value.imported, 1);
  assert.equal(result.value.skipped, 6);
});

test("an entry with no timestamp is placed at midday on its own date", () => {
  const csv = [
    "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
    "tracker,,t-cal,Calories,kcal,2000,,amber,false",
    "entry,2026-08-01,t-cal,Calories,kcal,450,,,",
  ].join("\r\n");

  const result = parseCsv(csv);
  assert.ok(result.ok);
  const at = result.value.days[0]?.entries[0]?.at;
  assert.ok(typeof at === "number" && Number.isFinite(at));
  assert.equal(new Date(at).getHours(), 12);
});

test("import refuses an implausibly large file", () => {
  const huge = `type,date,tracker_id,name,unit,amount,logged_at,colour,archived\n${"x".repeat(
    6 * 1024 * 1024,
  )}`;
  const result = parseCsv(huge);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /too large/);
});

test("a tracker name that a spreadsheet would execute is neutralised on export", () => {
  // Names are free text, so this is a real path: type the name, export, open
  // the backup in Excel.
  const hostile: Tracker[] = [
    {
      id: "t-x",
      name: "=1+1",
      unit: "@SUM",
      target: 10,
      colour: "amber",
      direction: "limit",
      archived: false,
    },
  ];
  const csv = exportCsv(hostile, []);
  const dataLine = csv.trim().split("\r\n")[1] ?? "";
  for (const field of dataLine.split(",")) {
    assert.ok(!/^[=+@]/.test(field), `field would execute in a spreadsheet: ${field}`);
  }
  // …and the prefix is stripped again on the way back in.
  const back = parseCsv(csv);
  assert.ok(back.ok);
  assert.equal(back.value.trackers[0]?.name, "=1+1");
  assert.equal(back.value.trackers[0]?.unit, "@SUM");
});

test("a name containing a comma or a quote survives a round trip", () => {
  const awkward: Tracker[] = [
    {
      id: "t-y",
      name: 'Salt, "added"',
      unit: "g",
      target: 6,
      colour: "slate",
      direction: "limit",
      archived: false,
    },
  ];
  const back = parseCsv(exportCsv(awkward, []));
  assert.ok(back.ok);
  assert.equal(back.value.trackers[0]?.name, 'Salt, "added"');
});

test("a file with an unknown header is rejected, not guessed at", () => {
  // The pre-release fixed-macro format is no longer accepted: it never
  // shipped, so no real backup uses it and guessing invites bad imports.
  const unknown = [
    "type,date,macro,amount,logged_at",
    "entry,2026-08-01,calories,450,2026-08-01T08:30:00.000Z",
  ].join("\r\n");

  const result = parseCsv(unknown);
  assert.ok(!result.ok);
  assert.match(result.error, /Unrecognised file/);
});

test("a pre-0.0.6 backup without a direction column imports as limits", () => {
  // The 9-column header shipped up to 0.0.5. It must still restore cleanly, so
  // an existing tester's backup is never rejected after the update.
  const legacy = [
    "type,date,tracker_id,name,unit,amount,logged_at,colour,archived",
    "tracker,,t-cal,Calories,kcal,2000,,amber,false",
  ].join("\r\n");

  const result = parseCsv(legacy);
  assert.ok(result.ok, result.ok ? "" : result.error);
  assert.equal(result.value.trackers[0]?.direction, "limit");
});

test("the direction column round-trips through export and import", () => {
  const result = parseCsv(exportCsv(trackers, days));
  assert.ok(result.ok);
  assert.equal(result.value.trackers.find((t) => t.id === "t-water")?.direction, "goal");
  assert.equal(result.value.trackers.find((t) => t.id === "t-cal")?.direction, "limit");
});
