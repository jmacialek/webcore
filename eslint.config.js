// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "proposal1/**",
      "proposal2/**",
      "proposal3/**",
      "index.html",
      "scripts/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.tooling.json", "./packages/*/tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Determinism (spec "Determinism", ADR 0003): the sim must be bit-identical
    // across JavaScript engines, so transcendental and engine-varying maths,
    // wall-clock time, and unseeded randomness are banned from its source.
    files: ["packages/sim/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        ...[
          "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh", "cbrt", "cos", "cosh",
          "exp", "expm1", "hypot", "log", "log10", "log1p", "log2", "pow", "random", "sin",
          "sinh", "tan", "tanh",
        ].map((property) => ({
          object: "Math",
          property,
          message: `Math.${property} is not bit-identical across engines; the sim may only use + - * / and Math.sqrt/floor/trunc/round/min/max/abs/imul.`,
        })),
        { object: "Date", property: "now", message: "The sim has no wall clock; time is the tick." },
        { object: "performance", property: "now", message: "The sim has no wall clock; time is the tick." },
        { object: "crypto", property: "getRandomValues", message: "All randomness comes from the Run's seeded Prng." },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date']", message: "The sim has no wall clock; time is the tick." },
        { selector: "BinaryExpression[operator='**']", message: "** is Math.pow; not bit-identical across engines." },
      ],
    },
  },
);
