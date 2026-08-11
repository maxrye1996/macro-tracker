import assert from "node:assert/strict";
import { test } from "node:test";
import { getThemePref, parseThemePref } from "./theme";

test("stored theme values parse to themselves", () => {
  assert.equal(parseThemePref("light"), "light");
  assert.equal(parseThemePref("dark"), "dark");
});

test("anything else falls back to following the system", () => {
  // localStorage can be hand-edited; a bad value must never stick the UI in a
  // broken half-theme.
  for (const junk of [null, undefined, "", "DARK", "Light ", 0, {}, "auto", '"dark"']) {
    assert.equal(parseThemePref(junk), "system");
  }
});

test("reading with no storage available means system", () => {
  // This Node process has no localStorage at all — the same situation as
  // Safari private mode. getThemePref must degrade, not throw.
  assert.equal(getThemePref(), "system");
});
