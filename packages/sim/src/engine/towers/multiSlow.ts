import type { VectoidState } from "../state.js";
import { Engine } from "../engine.js";
import type { TowerBehaviour } from "./behaviour.js";

interface MultiSlowState {
  periodTicks: number;
  slots: number;
  factor: number;
}

/**
 * Blue Rays 1: once per cooldown hits up to `slots` Vectoids in Range. The
 * first pass takes, in spawn order, those still at full speed; the second
 * fills the remaining slots with any other Vectoid in Range, again in spawn
 * order (towers research 1.3; v1.2 verification 1.4). Every victim is a
 * primary: it takes the Tower's damage under its own colour multiplier and
 * its speed becomes min(current, maxSpeed * factor), recovering at once.
 * The Fastest label is display only; the Tower never reads its mode.
 */
export const multiSlowBehaviour: TowerBehaviour<MultiSlowState> = {
  init(spec) {
    if (spec.mechanics.type !== "multiSlow") throw new Error("multiSlow behaviour on wrong tower");
    return {
      periodTicks: Engine.ticks(spec.cooldown),
      slots: spec.mechanics.slots,
      factor: spec.mechanics.factor,
    };
  },

  tick(tower, s, engine) {
    const inRange = engine.vectoids.filter((v) => v.alive && engine.inRange(tower, v));
    const chosen: VectoidState[] = [];
    for (const v of inRange) {
      if (chosen.length >= s.slots) break;
      if (v.speed === v.maxSpeed) chosen.push(v);
    }
    for (const v of inRange) {
      if (chosen.length >= s.slots) break;
      if (!chosen.includes(v)) chosen.push(v);
    }
    const first = chosen[0];
    if (first === undefined) {
      tower.targetId = null;
      return;
    }
    tower.targetId = first.id;
    tower.cooldownTicks = s.periodTicks - 1;
    engine.addBeam(tower.id, chosen.map((v) => v.id), 1);
    for (const v of chosen) {
      engine.slow(v, Math.min(v.speed, v.maxSpeed * s.factor));
      engine.dealDamage(v, engine.damageAgainst(tower, v.type), tower.id);
    }
  },
};
