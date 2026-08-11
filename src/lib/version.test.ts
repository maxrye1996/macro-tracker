import assert from "node:assert/strict";
import { test } from "node:test";
import { VERSION, VERSION_CODE, versionCodeFor } from "./version";

test("version codes always increase with the version", () => {
  // Play rejects an upload whose versionCode is not higher than the last, so
  // the ordering here is the thing that must never break.
  const ordered = ["0.0.1", "0.0.2", "0.1.0", "0.1.9", "0.2.0", "1.0.0", "1.2.3"];
  const codes = ordered.map(versionCodeFor);
  for (let i = 1; i < codes.length; i += 1) {
    assert.ok(
      (codes[i] ?? 0) > (codes[i - 1] ?? 0),
      `${ordered[i]} (${codes[i]}) must outrank ${ordered[i - 1]} (${codes[i - 1]})`,
    );
  }
  assert.equal(versionCodeFor("0.0.2"), 2);
  assert.equal(versionCodeFor("1.2.3"), 10203);
});

test("a malformed version is a build error, not a silent zero", () => {
  for (const bad of ["1.0", "1.2.3.4", "v1.0.0", "1.0.x", "1.0.100", "", "-1.0.0"]) {
    assert.throws(() => versionCodeFor(bad), /major\.minor\.patch/, `should reject "${bad}"`);
  }
});

test("the shipped version is well formed", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(VERSION_CODE, versionCodeFor(VERSION));
});
