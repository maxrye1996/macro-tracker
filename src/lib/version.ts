/**
 * The one place the app's version is written down.
 *
 * `npm run version:sync` (which `npm run sync` and `npm run build` both call)
 * pushes this into package.json and android/app/build.gradle, so the native
 * project can never ship a version that disagrees with the code.
 *
 * Bump this, add a CHANGELOG.md entry, then build. Nothing else to edit.
 */
export const VERSION = "0.0.7";

/**
 * Google Play needs a monotonically increasing integer per upload and will
 * reject a repeat. Deriving it from the version string makes that automatic:
 * 0.0.2 -> 2, 0.1.0 -> 100, 1.2.3 -> 10203. Each part is capped at 99, which
 * is plenty and keeps the number comfortably inside Play's limit.
 */
export function versionCodeFor(version: string): number {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 99)) {
    throw new Error(`VERSION must be "major.minor.patch" with each part 0-99, got "${version}"`);
  }
  const [major = 0, minor = 0, patch = 0] = parts;
  return major * 10000 + minor * 100 + patch;
}

export const VERSION_CODE = versionCodeFor(VERSION);
