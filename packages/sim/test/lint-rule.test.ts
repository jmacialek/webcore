/**
 * M1-16: the determinism lint rule in eslint.config.js (spec
 * "Determinism", ADR 0003) rejects transcendental and engine-varying
 * maths, the wall clock, and unseeded randomness anywhere under
 * packages/sim/src, and nowhere else.
 *
 * Probes are linted as text at a path under the sim source (and, as the
 * control, under the test directory) without touching the disk. The
 * repo's own flat config is used as-is, with type-aware rules switched off
 * for the probe: the probe file is not in any TSConfig, and the rules under
 * test are syntactic.
 */
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const SIM_SOURCE_PROBE = `${repoRoot}packages/sim/src/engine/__lint_probe__.ts`;
const TEST_PROBE = `${repoRoot}packages/sim/test/__probe__.ts`;

const RESTRICTION_RULES = new Set(["no-restricted-properties", "no-restricted-syntax"]);

/** One ESLint instance for the file: construction loads and validates the whole config. */
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfig: [{ files: ["**/*.ts"], ...tseslint.configs.disableTypeChecked }],
});

async function restrictions(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (result === undefined) throw new Error("ESLint returned no result");
  const fatal = result.messages.find((m) => m.fatal === true);
  if (fatal !== undefined) throw new Error(`probe did not parse: ${fatal.message}`);
  return result.messages.filter((m) => m.ruleId !== null && RESTRICTION_RULES.has(m.ruleId)).map((m) => m.ruleId ?? "");
}

const banned: readonly [snippet: string, ruleId: string][] = [
  ["export const x = Math.sin(1);", "no-restricted-properties"],
  ["export const x = Math.cos(1);", "no-restricted-properties"],
  ["export const x = Math.atan2(1, 2);", "no-restricted-properties"],
  ["export const x = Math.hypot(3, 4);", "no-restricted-properties"],
  ["export const x = Math.pow(2, 3);", "no-restricted-properties"],
  ["export const x = Math.exp(1);", "no-restricted-properties"],
  ["export const x = Math.log(2);", "no-restricted-properties"],
  ["export const x = Math.random();", "no-restricted-properties"],
  ["export const x = Date.now();", "no-restricted-properties"],
  ["export const x = performance.now();", "no-restricted-properties"],
  ["export const x = 2 ** 3;", "no-restricted-syntax"],
  ["export const x = new Date();", "no-restricted-syntax"],
];

const allowed: readonly string[] = [
  "export const x = Math.sqrt(2);",
  "export const x = Math.trunc(2.5);",
  "export const x = Math.floor(2.5) + Math.round(2.5) + Math.min(1, 2) + Math.max(1, 2) + Math.abs(-1);",
  "export const x = Math.imul(3, 4);",
  "export const x = 2 * 2 * 2;",
];

describe("determinism lint rule on packages/sim/src", () => {
  describe.each(banned)("%s", (snippet, ruleId) => {
    it(`is an ${ruleId} error in a sim source file`, async () => {
      expect(await restrictions(snippet, SIM_SOURCE_PROBE)).toEqual([ruleId]);
    });

    it("is not restricted in a sim test file (the rule is scoped to src)", async () => {
      expect(await restrictions(snippet, TEST_PROBE)).toEqual([]);
    });
  });

  describe.each(allowed.map((s) => [s] as const))("%s", (snippet) => {
    it("passes in a sim source file", async () => {
      expect(await restrictions(snippet, SIM_SOURCE_PROBE)).toEqual([]);
    });
  });

  it("reports every banned call in one file, not just the first", async () => {
    const code = ["export const a = Math.sin(1);", "export const b = Math.random();", "export const c = 2 ** 3;"].join("\n");
    expect(await restrictions(code, SIM_SOURCE_PROBE)).toEqual([
      "no-restricted-properties",
      "no-restricted-properties",
      "no-restricted-syntax",
    ]);
  });
});
