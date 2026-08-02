import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAmount, isMacroId, normaliseAmount } from "./macros";

test("normaliseAmount rejects everything that is not a usable positive number", () => {
  for (const bad of [NaN, Infinity, -Infinity, -1, 0, "", "  ", "abc", null, undefined, {}, []]) {
    assert.equal(normaliseAmount(bad, "calories"), null, `expected ${String(bad)} to be rejected`);
  }
});

test("normaliseAmount enforces the per-macro ceiling", () => {
  assert.equal(normaliseAmount(20_000, "calories"), 20_000);
  assert.equal(normaliseAmount(20_001, "calories"), null);
  assert.equal(normaliseAmount(2_000, "protein"), 2_000);
  assert.equal(normaliseAmount(2_001, "protein"), null);
});

test("normaliseAmount rounds to the macro's precision", () => {
  // Calories are whole numbers; grams keep one decimal.
  assert.equal(normaliseAmount(450.6, "calories"), 451);
  assert.equal(normaliseAmount(31.44, "protein"), 31.4);
  assert.equal(normaliseAmount(31.45, "protein"), 31.5);
});

test("normaliseAmount rejects a value that rounds away to zero", () => {
  // 0.4 kcal is not a thing anyone means to log, and storing 0 would create
  // entries that can never be seen in the totals.
  assert.equal(normaliseAmount(0.4, "calories"), null);
  assert.equal(normaliseAmount(0.04, "protein"), null);
});

test("normaliseAmount accepts numeric strings from text inputs", () => {
  assert.equal(normaliseAmount("450", "calories"), 450);
  assert.equal(normaliseAmount("30.5", "protein"), 30.5);
});

test("isMacroId does not accept prototype keys", () => {
  assert.equal(isMacroId("__proto__"), false);
  assert.equal(isMacroId("constructor"), false);
  assert.equal(isMacroId("toString"), false);
  assert.equal(isMacroId("protein"), true);
});

test("formatAmount drops a trailing .0 but keeps real decimals", () => {
  assert.equal(formatAmount(30, "protein"), "30");
  assert.equal(formatAmount(30.5, "protein"), "30.5");
  assert.equal(formatAmount(450.7, "calories"), "451");
});
