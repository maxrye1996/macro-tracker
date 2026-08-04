"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_test_1 = require("node:test");
const csp_1 = require("./csp");
function vercelHeaders(source) {
    const raw = (0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw);
    const rule = config.headers?.find((h) => h.source === source);
    strict_1.default.ok(rule, `vercel.json has no rule for ${source}`);
    return new Map(rule.headers.map((h) => [h.key, h.value]));
}
(0, node_test_1.test)("the header CSP in vercel.json matches the one the web build embeds", () => {
    // The meta tag protects the mobile build and the header protects the web
    // build. If they drift, one deployment silently loses a protection.
    strict_1.default.equal(vercelHeaders("/(.*)").get("Content-Security-Policy"), csp_1.PRODUCTION_WEB_CSP);
});
(0, node_test_1.test)("the installed mobile app can make no network request at all", () => {
    // This is the guarantee that survives adding analytics to the web demo:
    // the app people actually install still cannot reach a network.
    strict_1.default.match(csp_1.PRODUCTION_MOBILE_CSP, /connect-src 'none'/);
});
(0, node_test_1.test)("the web build reaches its own origin only, never a third party", () => {
    // Vercel Analytics beacons to /_vercel/insights on the same origin. No
    // external host is reachable, so no third party can receive anything.
    strict_1.default.match(csp_1.PRODUCTION_WEB_CSP, /connect-src 'self'/);
    strict_1.default.doesNotMatch(csp_1.PRODUCTION_WEB_CSP, /connect-src[^;]*(\*|https?:)/);
});
(0, node_test_1.test)("connect-src is the only directive that differs between the two targets", () => {
    const strip = (csp) => csp.replace(/connect-src[^;]*/, "");
    strict_1.default.equal(strip(csp_1.PRODUCTION_WEB_CSP), strip(csp_1.PRODUCTION_MOBILE_CSP));
});
(0, node_test_1.test)("development relaxes only the websocket rule", () => {
    const dev = (0, csp_1.buildCsp)("development");
    strict_1.default.match(dev, /connect-src 'self' ws: wss:/);
    strict_1.default.equal(dev.replace(/connect-src[^;]*/, ""), csp_1.PRODUCTION_WEB_CSP.replace(/connect-src[^;]*/, ""), "no other directive may differ between dev and production");
});
(0, node_test_1.test)("clickjacking is blocked by a directive a meta tag cannot deliver", () => {
    // frame-ancestors is ignored in <meta>, so the header is the only thing
    // actually enforcing it on the web build.
    strict_1.default.match(csp_1.PRODUCTION_WEB_CSP, /frame-ancestors 'none'/);
    strict_1.default.equal(vercelHeaders("/(.*)").get("X-Frame-Options"), "DENY");
});
(0, node_test_1.test)("the response carries the other baseline security headers", () => {
    const headers = vercelHeaders("/(.*)");
    strict_1.default.equal(headers.get("X-Content-Type-Options"), "nosniff");
    strict_1.default.equal(headers.get("Referrer-Policy"), "no-referrer");
    strict_1.default.match(headers.get("Strict-Transport-Security") ?? "", /max-age=\d+/);
    strict_1.default.match(headers.get("Permissions-Policy") ?? "", /camera=\(\)/);
});
(0, node_test_1.test)("hashed assets are cached immutably", () => {
    const cache = vercelHeaders("/_next/static/(.*)").get("Cache-Control");
    strict_1.default.match(cache ?? "", /immutable/);
});
