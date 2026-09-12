import type { VectoidState } from "../state.js";
import type { TowerBehaviour } from "./behaviour.js";
import { TICKS_PER_SECOND } from "../../types.js";

interface LaserState {
  /** Ticks to wait before re-scanning after losing a target. */
  waitTicks: number;
  hitsPerSecond: number;
  chainHops: number;
  chainRadius: number;
  reacquireTicks: number;
}

/**
 * Green Lasers: a continuous beam on a held target, `hitsPerSecond` hits a
 * second spread evenly over ticks. Holds the target until it dies or leaves
 * Range, then waits `reacquireDelay` before re-scanning (towers research 1.3).
 * Green Laser 2 chains once and 3 twice to a Vectoid within `chainRadius` of
 * the previous victim; every hop takes the primary's colour-adjusted damage.
 */
export const laserBehaviour: TowerBehaviour<LaserState> = {
  init(spec) {
    if (spec.mechanics.type !== "laser") throw new Error("laser behaviour on non-laser tower");
    const m = spec.mechanics;
    return {
      waitTicks: 0,
      hitsPerSecond: m.hitsPerSecond,
      chainHops: m.chainHops,
      chainRadius: m.chainRadius,
      reacquireTicks: Math.round(m.reacquireDelay * TICKS_PER_SECOND),
    };
  },

  tick(tower, s, engine) {
    if (s.waitTicks > 0) {
      s.waitTicks -= 1;
      return;
    }
    let target = engine.heldTarget(tower);
    if (target === null) {
      if (tower.targetId !== null) {
        // Target lost: drop it and wait before re-scanning.
        tower.targetId = null;
        s.waitTicks = s.reacquireTicks;
        return;
      }
      target = engine.pickTarget(tower, tower.mode);
      if (target === null) return;
      tower.targetId = target.id;
    }

    const perTick = engine.damageAgainst(tower, target.type) * (s.hitsPerSecond / TICKS_PER_SECOND);
    const victims: VectoidState[] = [target];
    let previous = target;
    const r2 = s.chainRadius * s.chainRadius;
    for (let hop = 0; hop < s.chainHops; hop += 1) {
      const next = engine.nearestVectoid(previous.x, previous.y, r2, victims);
      if (next === null) break;
      victims.push(next);
      previous = next;
    }
    engine.addBeam(tower.id, victims.map((v) => v.id), 1);
    for (const v of victims) engine.dealDamage(v, perTick, tower.id);
    if (!target.alive) {
      tower.targetId = null;
      s.waitTicks = s.reacquireTicks;
    }
  },
};
