/**
 * The Content-Security-Policy, defined once and used by both deployment
 * targets.
 *
 * The web build gets it as a real HTTP header from `vercel.json`; the packaged
 * mobile build gets it from a `<meta>` tag, because a Capacitor webview loads
 * files off disk and there is no server to send headers. Both are needed, and
 * `csp.test.ts` fails the build if the two ever drift apart.
 *
 * `script-src` has to allow inline for Next's bootstrap — a static export
 * cannot use per-request nonces. That is acceptable here only because the app
 * renders no HTML it did not author: no `dangerouslySetInnerHTML` (ESLint
 * enforces it), and no remote content of any kind.
 */

import type { BuildTarget } from "./target";

/**
 * `connect-src` is the directive that decides whether this app can talk to a
 * network at all, so it is spelled out per target rather than hidden in a
 * conditional:
 *
 * - **mobile** — `'none'`. The installed app cannot make a request even if
 *   someone later adds a `fetch` by accident. The privacy guarantee is
 *   enforced by the browser, not by discipline.
 * - **web** — `'self'`. Vercel Analytics beacons to `/_vercel/insights/*` on
 *   the same origin. Still no third-party host is reachable, and a user's
 *   logged data is never part of any request.
 * - **development** — plus websockets, for hot reload.
 */
function connectSrc(mode: "production" | "development", target: BuildTarget): string {
  if (mode === "development") return "connect-src 'self' ws: wss:";
  return target === "mobile" ? "connect-src 'none'" : "connect-src 'self'";
}

export function buildCsp(
  mode: "production" | "development",
  target: BuildTarget = "web",
): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    connectSrc(mode, target),
    "form-action 'none'",
    // Only enforced when delivered as a header; ignored in a meta tag.
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
  ].join("; ");
}

/** The exact string `vercel.json` must send. */
export const PRODUCTION_WEB_CSP = buildCsp("production", "web");

/** What the installed iOS/Android app enforces. */
export const PRODUCTION_MOBILE_CSP = buildCsp("production", "mobile");
