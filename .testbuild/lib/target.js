"use strict";
/**
 * Which deployment this bundle is being built for.
 *
 * The web build and the packaged mobile build come out of the same `out/`
 * directory, so anything that must differ between them keys off this flag,
 * which is inlined at build time.
 *
 * The only thing that currently differs is analytics: the web demo reports
 * anonymous page views, and the app people install on their phone makes no
 * network requests whatsoever. `npm run sync` sets this to "mobile" before
 * building for Capacitor.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IS_MOBILE_BUILD = exports.BUILD_TARGET = void 0;
exports.BUILD_TARGET = process.env.NEXT_PUBLIC_BUILD_TARGET === "mobile" ? "mobile" : "web";
exports.IS_MOBILE_BUILD = exports.BUILD_TARGET === "mobile";
