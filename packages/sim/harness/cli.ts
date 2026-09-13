/**
 * Balancing harness entry point.
 *
 *   pnpm --filter @vector3d/sim harness <build-order> [--ruleset classic] [--seed 1] [--map switchback] [--ticks N]
 */
import { parseArgs } from "node:util";
import { buildOrders } from "./build-orders/index.js";
import { formatReport, runHarness } from "./harness.js";
import type { HarnessOptions } from "./harness.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    ruleset: { type: "string" },
    seed: { type: "string" },
    map: { type: "string" },
    ticks: { type: "string" },
  },
});

const names = Object.keys(buildOrders).sort().join(", ");
const [name] = positionals;
const buildOrder = name === undefined ? undefined : buildOrders[name];
if (buildOrder === undefined) {
  process.stderr.write(`usage: harness <build-order> [--ruleset original|classic] [--seed N] [--map id] [--ticks N]\nbuild orders: ${names}\n`);
  process.exit(2);
}

function integer(flag: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${flag} must be a non-negative integer, got "${raw}"`);
  return n;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const options: Mutable<HarnessOptions> = {};
if (values.ruleset !== undefined) options.ruleset = values.ruleset;
if (values.map !== undefined) options.map = values.map;
const seed = integer("seed", values.seed);
if (seed !== undefined) options.seed = seed;
const tickCap = integer("ticks", values.ticks);
if (tickCap !== undefined) options.tickCap = tickCap;

const started = performance.now();
const result = runHarness(buildOrder, options);
const elapsed = performance.now() - started;
for (const line of formatReport(result)) process.stdout.write(`${line}\n`);
process.stdout.write(`(harness ran in ${(elapsed / 1000).toFixed(2)} s wall)\n`);
