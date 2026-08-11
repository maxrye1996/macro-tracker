/**
 * Propagates src/lib/version.ts into every file that needs to agree with it:
 * package.json and the Android build.gradle. Run automatically by `npm run
 * build` and `npm run sync`, so a release can never be cut with a stale
 * versionCode — the mistake Play punishes by rejecting the upload.
 *
 * Reads the constant with a regex rather than importing it, so this stays a
 * plain Node script with no build step of its own.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const versionSource = readFileSync("src/lib/version.ts", "utf8");
const match = /export const VERSION = "([^"]+)"/.exec(versionSource);
if (!match?.[1]) throw new Error("Could not find VERSION in src/lib/version.ts");
const version = match[1];

const parts = version.split(".").map((p) => Number.parseInt(p, 10));
if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 99)) {
  throw new Error(`VERSION must be "major.minor.patch" with each part 0-99, got "${version}"`);
}
const [major, minor, patch] = parts;
const versionCode = major * 10000 + minor * 100 + patch;

const changed = [];

// package.json
const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (pkg.version !== version) {
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  changed.push(pkgPath);
}

// Android. Absent until `npx cap add android` has been run, which is fine.
const gradlePath = "android/app/build.gradle";
if (existsSync(gradlePath)) {
  const before = readFileSync(gradlePath, "utf8");
  const after = before
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  if (after !== before) {
    writeFileSync(gradlePath, after);
    changed.push(gradlePath);
  }
}

// iOS reads its version from Info.plist via Xcode build settings; wire that up
// here when the platform is added.

const summary = changed.length ? `updated ${changed.join(", ")}` : "already in sync";
console.log(`version ${version} (versionCode ${versionCode}) — ${summary}`);
