import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "out/**", ".testbuild/**", "ios/**", "android/**"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // The app never renders HTML it did not author; this makes that a rule
      // rather than a habit.
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    // Store and migration tests install a localStorage shim on globalThis and
    // must load the modules under test *after* it exists, which a hoisted
    // `import` cannot do.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default config;
