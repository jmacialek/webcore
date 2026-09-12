/**
 * Ruleset surface: the two shipped Rulesets, the diff that derives Classic
 * from Original, and the pure Wave derivations.
 */

import type { Ruleset, TowerKind, TowerSpec } from "./types.js";
import { classic } from "./classic.js";
import { original } from "./original.js";

export * from "./types.js";
export { original } from "./original.js";
export { classic, classicDiff } from "./classic.js";
export { applyRulesetDiff } from "./diff.js";
export { waveStats, waveTable, waveComposition } from "./waves.js";
export type { WaveStats } from "./waves.js";

const registry: ReadonlyMap<string, Ruleset> = new Map([
  [original.id, original],
  [classic.id, classic],
]);

/** The Ruleset with this id, or undefined if none is registered. */
export function getRuleset(id: string): Ruleset | undefined {
  return registry.get(id);
}

/** The Ruleset's spec for `kind`, or undefined if that Ruleset lacks it. */
export function getTowerSpec(ruleset: Ruleset, kind: TowerKind): TowerSpec | undefined {
  return ruleset.towers.find((t) => t.kind === kind);
}
