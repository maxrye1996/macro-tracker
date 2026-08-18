import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAmount,
  formatWithUnit,
  isColourId,
  NAME_MAX,
  nextColour,
  normaliseAmount,
  sanitiseName,
  sanitiseUnit,
  UNIT_MAX,
  VALUE_MAX,
  type Tracker,
} from "./trackers";

test("normaliseAmount rejects everything that is not a usable positive number", () => {
  for (const bad of [NaN, Infinity, -Infinity, -1, 0, "", "  ", "abc", null, undefined, {}]) {
    assert.equal(normaliseAmount(bad), null, `expected ${String(bad)} to be rejected`);
  }
});

test("normaliseAmount enforces the ceiling", () => {
  assert.equal(normaliseAmount(VALUE_MAX), VALUE_MAX);
  assert.equal(normaliseAmount(VALUE_MAX + 1), null);
});

test("normaliseAmount rounds to one decimal and rejects what rounds to zero", () => {
  assert.equal(normaliseAmount(31.44), 31.4);
  assert.equal(normaliseAmount(31.45), 31.5);
  assert.equal(normaliseAmount(0.04), null);
});

test("normaliseAmount accepts a comma decimal separator", () => {
  // European keyboards produce "1,5" and the user means one and a half.
  assert.equal(normaliseAmount("1,5"), 1.5);
  assert.equal(normaliseAmount("450"), 450);
});

test("sanitiseName strips control characters and bidi overrides", () => {
  // A right-to-left override can make a stored name render as something other
  // than what is stored, so it never reaches storage in the first place.
  assert.equal(sanitiseName("Wa\u0000ter"), "Water");
  assert.equal(sanitiseName("Water\u202E"), "Water");
  assert.equal(sanitiseName("Wa\u200Bter"), "Water");
  assert.equal(sanitiseName("line\nbreak"), "line break");
});

test("sanitiseName collapses whitespace and trims", () => {
  assert.equal(sanitiseName("  Vitamin   D  "), "Vitamin D");
  assert.equal(sanitiseName("   "), "");
});

test("sanitiseName and sanitiseUnit cap their length", () => {
  assert.equal(sanitiseName("x".repeat(200)).length, NAME_MAX);
  assert.equal(sanitiseUnit("x".repeat(200)).length, UNIT_MAX);
});

test("sanitiseName rejects non-strings rather than coercing them", () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(sanitiseName(bad), "");
  }
});

test("isColourId does not accept prototype keys or unknown colours", () => {
  assert.equal(isColourId("__proto__"), false);
  assert.equal(isColourId("constructor"), false);
  assert.equal(isColourId("hotpink"), false);
  assert.equal(isColourId("amber"), true);
});

test("formatAmount drops a trailing .0 but keeps real decimals", () => {
  assert.equal(formatAmount(30), "30");
  assert.equal(formatAmount(30.5), "30.5");
});

test("formatWithUnit omits the space when a tracker has no unit", () => {
  assert.equal(formatWithUnit(8000, ""), "8,000");
  assert.equal(formatWithUnit(500, "ml"), "500 ml");
});

test("nextColour avoids colours already in use", () => {
  const used: Tracker[] = [
    { id: "1", name: "A", unit: "", target: 1, colour: "amber", direction: "limit", archived: false },
    { id: "2", name: "B", unit: "", target: 1, colour: "blue", direction: "limit", archived: false },
  ];
  const picked = nextColour(used);
  assert.ok(picked !== "amber" && picked !== "blue");
});
