"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const macros_1 = require("./macros");
(0, node_test_1.test)("normaliseAmount rejects everything that is not a usable positive number", () => {
    for (const bad of [NaN, Infinity, -Infinity, -1, 0, "", "  ", "abc", null, undefined, {}, []]) {
        strict_1.default.equal((0, macros_1.normaliseAmount)(bad, "calories"), null, `expected ${String(bad)} to be rejected`);
    }
});
(0, node_test_1.test)("normaliseAmount enforces the per-macro ceiling", () => {
    strict_1.default.equal((0, macros_1.normaliseAmount)(20_000, "calories"), 20_000);
    strict_1.default.equal((0, macros_1.normaliseAmount)(20_001, "calories"), null);
    strict_1.default.equal((0, macros_1.normaliseAmount)(2_000, "protein"), 2_000);
    strict_1.default.equal((0, macros_1.normaliseAmount)(2_001, "protein"), null);
});
(0, node_test_1.test)("normaliseAmount rounds to the macro's precision", () => {
    // Calories are whole numbers; grams keep one decimal.
    strict_1.default.equal((0, macros_1.normaliseAmount)(450.6, "calories"), 451);
    strict_1.default.equal((0, macros_1.normaliseAmount)(31.44, "protein"), 31.4);
    strict_1.default.equal((0, macros_1.normaliseAmount)(31.45, "protein"), 31.5);
});
(0, node_test_1.test)("normaliseAmount rejects a value that rounds away to zero", () => {
    // 0.4 kcal is not a thing anyone means to log, and storing 0 would create
    // entries that can never be seen in the totals.
    strict_1.default.equal((0, macros_1.normaliseAmount)(0.4, "calories"), null);
    strict_1.default.equal((0, macros_1.normaliseAmount)(0.04, "protein"), null);
});
(0, node_test_1.test)("normaliseAmount accepts numeric strings from text inputs", () => {
    strict_1.default.equal((0, macros_1.normaliseAmount)("450", "calories"), 450);
    strict_1.default.equal((0, macros_1.normaliseAmount)("30.5", "protein"), 30.5);
});
(0, node_test_1.test)("isMacroId does not accept prototype keys", () => {
    strict_1.default.equal((0, macros_1.isMacroId)("__proto__"), false);
    strict_1.default.equal((0, macros_1.isMacroId)("constructor"), false);
    strict_1.default.equal((0, macros_1.isMacroId)("toString"), false);
    strict_1.default.equal((0, macros_1.isMacroId)("protein"), true);
});
(0, node_test_1.test)("formatAmount drops a trailing .0 but keeps real decimals", () => {
    strict_1.default.equal((0, macros_1.formatAmount)(30, "protein"), "30");
    strict_1.default.equal((0, macros_1.formatAmount)(30.5, "protein"), "30.5");
    strict_1.default.equal((0, macros_1.formatAmount)(450.7, "calories"), "451");
});
