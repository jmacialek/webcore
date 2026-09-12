/**
 * Wave hit points, Bounty, and composition, derived from a Ruleset.
 *
 * The HP progression reproduces the v1.2 `wave()` update exactly as the AS2
 * runs it (docs/research/vector-td-waves-and-economy.md 1.2):
 *
 *   baseHP += int(baseHP / k); baseWorth += 1; k += step
 *
 * AS2 numbers are IEEE doubles and `int()` truncates toward zero, so the
 * same expression in JS with `Math.trunc` gives the same fifty rows.
 */

import type { MapTier } from "../map/types.js";
import type { Ruleset, VectoidType } from "./types.js";

export interface WaveStats {
  readonly hp: number;
  readonly bounty: number;
}

/** Every Map has exactly two Lanes (map/types.ts GameMap.lanes). */
const LANES_PER_MAP = 2;

/**
 * Wave 50 ("All types"): `spawn()` assigns creep type `int(cc / 5) + 1` to
 * the cc-th spawn (1-based) and maps code 6 to Hard Grey (waves 1.1,
 * verify 4). Indexed by `int(cc / 5)`.
 */
const MIXED_ORDER: readonly VectoidType[] = [
  "redShredder",
  "blueSpinner",
  "greenFlyer",
  "yellowSprinter",
  "bigPurpleBox",
  "hardGrey",
];

function assertWave(wave: number): void {
  if (!Number.isInteger(wave) || wave < 1) {
    throw new RangeError(`Wave must be a positive integer, got ${String(wave)}`);
  }
}

/** Hit points and Bounty of every Wave 1..n for a tier, in Wave order. */
function progression(ruleset: Ruleset, tier: MapTier, n: number): WaveStats[] {
  const { startHp, hpDivisor, hpDivisorStep, bountyOffset } = ruleset.economy.tiers[tier];
  const rows: WaveStats[] = [];
  let hp = startHp;
  let k = hpDivisor;
  for (let wave = 1; wave <= n; wave += 1) {
    if (wave > 1) {
      hp += Math.trunc(hp / k);
      k += hpDivisorStep;
    }
    rows.push({ hp, bounty: wave + bountyOffset });
  }
  return rows;
}

/**
 * Hit points of one Vectoid (before its type's hpMultiplier) and Bounty per
 * kill for `wave` (1-based) on a Map of `tier`. Pure.
 *
 * @throws RangeError if `wave` is not a positive integer.
 */
export function waveStats(ruleset: Ruleset, tier: MapTier, wave: number): WaveStats {
  assertWave(wave);
  const rows = progression(ruleset, tier, wave);
  const last = rows[wave - 1];
  if (last === undefined) {
    throw new RangeError(`no stats for Wave ${String(wave)}`);
  }
  return last;
}

/** `waveStats` for every entry of the Ruleset's Wave sequence. Pure. */
export function waveTable(ruleset: Ruleset, tier: MapTier): readonly WaveStats[] {
  return progression(ruleset, tier, ruleset.waves.length);
}

/**
 * The Vectoid types of `wave` (1-based) in spawn order: Lane 0's
 * `vectoidsPerLane`, then Lane 1's. On a Bonus Wave the last Vectoid of the
 * last Lane is the Bonus Cell (waves 1.1: `waveB`). Pure.
 *
 * @throws RangeError if `wave` is outside the Ruleset's Wave sequence.
 */
export function waveComposition(ruleset: Ruleset, wave: number): readonly VectoidType[] {
  assertWave(wave);
  const entry = ruleset.waves[wave - 1];
  if (entry === undefined) {
    throw new RangeError(`Wave ${String(wave)} is outside the ${String(ruleset.waves.length)}-Wave sequence`);
  }
  const total = ruleset.movement.vectoidsPerLane * LANES_PER_MAP;
  const types: VectoidType[] = [];
  for (let cc = 1; cc <= total; cc += 1) {
    types.push(entry === "mixed" ? mixedType(cc) : entry);
  }
  if (wave % ruleset.bonusWaveEvery === 0 && total > 0) {
    types[total - 1] = "bonusCell";
  }
  return types;
}

function mixedType(cc: number): VectoidType {
  const type = MIXED_ORDER[Math.min(Math.trunc(cc / 5), MIXED_ORDER.length - 1)];
  if (type === undefined) {
    throw new Error("MIXED_ORDER is empty");
  }
  return type;
}
