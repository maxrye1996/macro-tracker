import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildCsp, PRODUCTION_MOBILE_CSP, PRODUCTION_WEB_CSP } from "./csp";

interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}

function vercelHeaders(source: string): Map<string, string> {
  const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
  const config = JSON.parse(raw) as VercelConfig;
  const rule = config.headers?.find((h) => h.source === source);
  assert.ok(rule, `vercel.json has no rule for ${source}`);
  return new Map(rule.headers.map((h) => [h.key, h.value]));
}

test("the header CSP in vercel.json matches the one the web build embeds", () => {
  // The meta tag protects the mobile build and the header protects the web
  // build. If they drift, one deployment silently loses a protection.
  assert.equal(vercelHeaders("/(.*)").get("Content-Security-Policy"), PRODUCTION_WEB_CSP);
});

test("the installed mobile app can make no network request at all", () => {
  // This is the guarantee that survives adding analytics to the web demo:
  // the app people actually install still cannot reach a network.
  assert.match(PRODUCTION_MOBILE_CSP, /connect-src 'none'/);
});

test("the web build reaches its own origin only, never a third party", () => {
  // Vercel Analytics beacons to /_vercel/insights on the same origin. No
  // external host is reachable, so no third party can receive anything.
  assert.match(PRODUCTION_WEB_CSP, /connect-src 'self'/);
  assert.doesNotMatch(PRODUCTION_WEB_CSP, /connect-src[^;]*(\*|https?:)/);
});

test("connect-src is the only directive that differs between the two targets", () => {
  const strip = (csp: string) => csp.replace(/connect-src[^;]*/, "");
  assert.equal(strip(PRODUCTION_WEB_CSP), strip(PRODUCTION_MOBILE_CSP));
});

test("development relaxes only the websocket rule", () => {
  const dev = buildCsp("development");
  assert.match(dev, /connect-src 'self' ws: wss:/);
  assert.equal(
    dev.replace(/connect-src[^;]*/, ""),
    PRODUCTION_WEB_CSP.replace(/connect-src[^;]*/, ""),
    "no other directive may differ between dev and production",
  );
});

test("clickjacking is blocked by a directive a meta tag cannot deliver", () => {
  // frame-ancestors is ignored in <meta>, so the header is the only thing
  // actually enforcing it on the web build.
  assert.match(PRODUCTION_WEB_CSP, /frame-ancestors 'none'/);
  assert.equal(vercelHeaders("/(.*)").get("X-Frame-Options"), "DENY");
});

test("the response carries the other baseline security headers", () => {
  const headers = vercelHeaders("/(.*)");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "no-referrer");
  assert.match(headers.get("Strict-Transport-Security") ?? "", /max-age=\d+/);
  assert.match(headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
});

test("hashed assets are cached immutably", () => {
  const cache = vercelHeaders("/_next/static/(.*)").get("Cache-Control");
  assert.match(cache ?? "", /immutable/);
});
