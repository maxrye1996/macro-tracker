"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const trackers_1 = require("./trackers");
(0, node_test_1.test)("normaliseAmount rejects everything that is not a usable positive number", () => {
    for (const bad of [NaN, Infinity, -Infinity, -1, 0, "", "  ", "abc", null, undefined, {}]) {
        strict_1.default.equal((0, trackers_1.normaliseAmount)(bad), null, `expected ${String(bad)} to be rejected`);
    }
});
(0, node_test_1.test)("normaliseAmount enforces the ceiling", () => {
    strict_1.default.equal((0, trackers_1.normaliseAmount)(trackers_1.VALUE_MAX), trackers_1.VALUE_MAX);
    strict_1.default.equal((0, trackers_1.normaliseAmount)(trackers_1.VALUE_MAX + 1), null);
});
(0, node_test_1.test)("normaliseAmount rounds to one decimal and rejects what rounds to zero", () => {
    strict_1.default.equal((0, trackers_1.normaliseAmount)(31.44), 31.4);
    strict_1.default.equal((0, trackers_1.normaliseAmount)(31.45), 31.5);
    strict_1.default.equal((0, trackers_1.normaliseAmount)(0.04), null);
});
(0, node_test_1.test)("normaliseAmount accepts a comma decimal separator", () => {
    // European keyboards produce "1,5" and the user means one and a half.
    strict_1.default.equal((0, trackers_1.normaliseAmount)("1,5"), 1.5);
    strict_1.default.equal((0, trackers_1.normaliseAmount)("450"), 450);
});
(0, node_test_1.test)("sanitiseName strips control characters and bidi overrides", () => {
    // A right-to-left override can make a stored name render as something other
    // than what is stored, so it never reaches storage in the first place.
    strict_1.default.equal((0, trackers_1.sanitiseName)("Wa\u0000ter"), "Water");
    strict_1.default.equal((0, trackers_1.sanitiseName)("Water\u202E"), "Water");
    strict_1.default.equal((0, trackers_1.sanitiseName)("Wa\u200Bter"), "Water");
    strict_1.default.equal((0, trackers_1.sanitiseName)("line\nbreak"), "line break");
});
(0, node_test_1.test)("sanitiseName collapses whitespace and trims", () => {
    strict_1.default.equal((0, trackers_1.sanitiseName)("  Vitamin   D  "), "Vitamin D");
    strict_1.default.equal((0, trackers_1.sanitiseName)("   "), "");
});
(0, node_test_1.test)("sanitiseName and sanitiseUnit cap their length", () => {
    strict_1.default.equal((0, trackers_1.sanitiseName)("x".repeat(200)).length, trackers_1.NAME_MAX);
    strict_1.default.equal((0, trackers_1.sanitiseUnit)("x".repeat(200)).length, trackers_1.UNIT_MAX);
});
(0, node_test_1.test)("sanitiseName rejects non-strings rather than coercing them", () => {
    for (const bad of [null, undefined, 42, {}, []]) {
        strict_1.default.equal((0, trackers_1.sanitiseName)(bad), "");
    }
});
(0, node_test_1.test)("isColourId does not accept prototype keys or unknown colours", () => {
    strict_1.default.equal((0, trackers_1.isColourId)("__proto__"), false);
    strict_1.default.equal((0, trackers_1.isColourId)("constructor"), false);
    strict_1.default.equal((0, trackers_1.isColourId)("hotpink"), false);
    strict_1.default.equal((0, trackers_1.isColourId)("amber"), true);
});
(0, node_test_1.test)("formatAmount drops a trailing .0 but keeps real decimals", () => {
    strict_1.default.equal((0, trackers_1.formatAmount)(30), "30");
    strict_1.default.equal((0, trackers_1.formatAmount)(30.5), "30.5");
});
(0, node_test_1.test)("formatWithUnit omits the space when a tracker has no unit", () => {
    strict_1.default.equal((0, trackers_1.formatWithUnit)(8000, ""), "8,000");
    strict_1.default.equal((0, trackers_1.formatWithUnit)(500, "ml"), "500 ml");
});
(0, node_test_1.test)("nextColour avoids colours already in use", () => {
    const used = [
        { id: "1", name: "A", unit: "", target: 1, colour: "amber", archived: false },
        { id: "2", name: "B", unit: "", target: 1, colour: "blue", archived: false },
    ];
    const picked = (0, trackers_1.nextColour)(used);
    strict_1.default.ok(picked !== "amber" && picked !== "blue");
});
