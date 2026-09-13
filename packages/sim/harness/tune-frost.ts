/**
 * M1-18: Blue Frost Rockets tuning. Plays `red-rockets`, `frost-rockets`,
 * and `mixed-rockets` under Classic with each candidate Frost spec swapped
 * into the Ruleset (`applyRulesetDiff(original, { ...classicDiff, addTowers:
 * [candidate] })`; nothing under src/ is edited) over several seeds, and
 * prints one Markdown table per candidate: Waves survived, Leaks on the
 * Yellow Sprinter Waves, and Score. The shipped numbers are the candidate
 * named "final"; the placeholders of M1-15 are kept as "placeholder" so the
 * comparison in ticket #19 can be regenerated.
 *
 *   pnpm --filter @vector3d/sim tune-frost [--seeds 3] [--only final,placeholder]
 */
import { parseArgs } from "node:util";
import { applyRulesetDiff, classicDiff, getTowerSpec, original } from "../src/index.js";
import type { Ruleset, TowerMechanics, TowerSpec } from "../src/index.js";
import { buildOrders } from "./build-orders/index.js";
import { runHarness } from "./harness.js";
import type { BuildOrder, HarnessResult } from "./harness.js";

interface Candidate {
  readonly name: string;
  readonly damage: number;
  readonly range: number;
  readonly cooldown: number;
  readonly radius: number;
  readonly factor: number;
  readonly duration: number;
}

const shippedSpec = getTowerSpec(applyRulesetDiff(original, classicDiff), "blueFrostRockets");
if (shippedSpec === undefined) throw new Error("Classic has no Blue Frost Rockets");
const shipped: TowerSpec = shippedSpec;
const mechanics = shipped.mechanics;
if (mechanics.type !== "homingRocket" || mechanics.splashSlow === undefined) throw new Error("Blue Frost Rockets is not a homing rocket with a splash slow");
/** Narrowed once here; the functions below are hoisted and would otherwise see the whole union. */
const flight: Extract<TowerMechanics, { type: "homingRocket" }> = mechanics;
const slow = mechanics.splashSlow;

/** The M1-15 placeholders, the shipped numbers, and the neighbours that were weighed against them. */
const candidates: readonly Candidate[] = [
  { name: "placeholder", damage: 3000, range: 6.0, cooldown: 1.5, radius: 2, factor: 1 / 6, duration: 1 },
  { name: "final", damage: shipped.damage, range: shipped.range, cooldown: shipped.cooldown, radius: slow.radius, factor: slow.factor, duration: slow.duration },
  // Neighbours of the final numbers, one knob each. Frost alone lets 9 of Wave 22's Sprinters through at the final numbers;
  // less of anything lets more through, more carries the build to Wave 31 where the 87,850-hp Sprinters Leak in numbers.
  { name: "final-damage-4500", damage: 4500, range: 6.0, cooldown: 3, radius: 1.5, factor: 1 / 2, duration: 1 },
  { name: "final-damage-5500", damage: 5500, range: 6.0, cooldown: 3, radius: 1.5, factor: 1 / 2, duration: 1 },
  { name: "final-cooldown-2.5", damage: 5000, range: 6.0, cooldown: 2.5, radius: 1.5, factor: 1 / 2, duration: 1 },
  { name: "final-cooldown-3.5", damage: 5000, range: 6.0, cooldown: 3.5, radius: 1.5, factor: 1 / 2, duration: 1 },
  { name: "final-radius-2", damage: 5000, range: 6.0, cooldown: 3, radius: 2, factor: 1 / 2, duration: 1 },
  { name: "final-duration-2", damage: 5000, range: 6.0, cooldown: 3, radius: 1.5, factor: 1 / 2, duration: 2 },
  { name: "final-factor-two-thirds", damage: 5000, range: 6.0, cooldown: 3, radius: 1.5, factor: 2 / 3, duration: 1 },
  // Red Rockets' damage with the placeholder slow: the Refractors behind a permanent crawl win outright.
  { name: "damage-12000-placeholder-slow", damage: 12000, range: 6.0, cooldown: 1.5, radius: 2, factor: 1 / 6, duration: 1 },
];

function rulesetFor(c: Candidate): Ruleset {
  const spec: TowerSpec = {
    ...shipped,
    damage: c.damage,
    range: c.range,
    cooldown: c.cooldown,
    mechanics: { ...flight, splashSlow: { radius: c.radius, factor: c.factor, duration: c.duration } },
  };
  return applyRulesetDiff(original, { ...classicDiff, id: `classic-tune-${c.name}`, addTowers: [spec] });
}

const sprinterWaves = new Set(original.waves.flatMap((entry, i) => (entry === "yellowSprinter" ? [i + 1] : [])));

interface Outcome {
  readonly wavesSurvived: number;
  readonly sprinterLeaks: number;
  /** Leaks on the Sprinter Waves every build reaches (6, 14, 22), for a like-for-like comparison. */
  readonly earlySprinterLeaks: number;
  readonly leaks: number;
  readonly score: number;
  readonly outcome: string;
}

function summarise(r: HarnessResult): Outcome {
  const last = r.waves.at(-1);
  // A defeat during Wave n means n - 1 Waves survived; a victory survives all fifty.
  const wavesSurvived = r.outcome === "victory" ? 50 : last === undefined ? 0 : last.wave - 1;
  let sprinterLeaks = 0;
  let earlySprinterLeaks = 0;
  let leaks = 0;
  for (const row of r.waves) {
    leaks += row.leaked;
    if (!sprinterWaves.has(row.wave)) continue;
    sprinterLeaks += row.leaked;
    if (row.wave <= 22) earlySprinterLeaks += row.leaked;
  }
  return { wavesSurvived, sprinterLeaks, earlySprinterLeaks, leaks, score: r.score, outcome: r.outcome ?? "cap" };
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { seeds: { type: "string", default: "3" }, only: { type: "string" }, grid: { type: "boolean", default: false }, compact: { type: "boolean", default: false } },
});
const seedCount = Number(values.seeds);
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error("--seeds must be a positive integer");
const only = values.only?.split(",");
const seeds = Array.from({ length: seedCount }, (_, i) => i + 1);
const names = ["red-rockets", "frost-rockets", "mixed-rockets"];
const orders: BuildOrder[] = names.map((n) => {
  const b = buildOrders[n];
  if (b === undefined) throw new Error(`no build order ${n}`);
  return b;
});

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "");
}

/** Every combination of a coarse grid, for a first sweep (`--grid`). */
function grid(): Candidate[] {
  const list: Candidate[] = [];
  for (const damage of [4000, 4500, 5000, 5500])
    for (const factor of [1 / 2])
      for (const duration of [1, 1.5, 2])
        for (const radius of [1.5, 2])
          for (const cooldown of [2.5, 3, 3.5, 4])
            list.push({ name: `d${String(damage)}-f${factor.toFixed(2)}-t${String(duration)}-r${String(radius)}-c${String(cooldown)}`, damage, range: 6, cooldown, radius, factor, duration });
  return list;
}

const out: string[] = [];
for (const c of values.grid ? grid() : candidates) {
  if (values.compact) {
    const ruleset = rulesetFor(c);
    const cells = orders.map((order) => {
      const o = summarise(runHarness(order, { ruleset, seed: 1 }));
      return `${String(o.wavesSurvived)}w/${String(o.earlySprinterLeaks)}e/${String(o.sprinterLeaks)}s`;
    });
    out.push(`${c.name.padEnd(28)} ${cells.map((x) => x.padStart(12)).join(" ")}`);
    continue;
  }
  if (only !== undefined && !only.includes(c.name)) continue;
  const ruleset = rulesetFor(c);
  out.push(`### ${c.name}: damage ${fmt(c.damage)}, Range ${fmt(c.range)}, cooldown ${fmt(c.cooldown)} s, slow radius ${fmt(c.radius)} / factor ${fmt(c.factor)} / duration ${fmt(c.duration)} s`);
  out.push("");
  out.push(`| Build order (Classic) | Seed | Waves survived | Leaks on Sprinter Waves (${[...sprinterWaves].join(", ")}) | Leaks total | Score | Outcome |`);
  out.push("|---|---|---|---|---|---|---|");
  for (const order of orders) {
    for (const seed of seeds) {
      const o = summarise(runHarness(order, { ruleset, seed }));
      out.push(`| ${order.name} | ${String(seed)} | ${String(o.wavesSurvived)} | ${String(o.sprinterLeaks)} | ${String(o.leaks)} | ${o.score.toLocaleString("en-US")} | ${o.outcome} |`);
    }
  }
  out.push("");
}
process.stdout.write(`${out.join("\n")}\n`);
