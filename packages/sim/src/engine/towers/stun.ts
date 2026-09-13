import type { TowerBehaviour } from "./behaviour.js";
import { TICKS_PER_SECOND } from "../../types.js";

interface StunState {
  periodTicks: number;
}

/**
 * Blue Rays 2: once per cooldown hits the single fastest Vectoid in Range
 * (strict `speed > best`, ties to the earliest spawned; towers research
 * 1.3 and 3.1) for the Tower's damage under the colour rule and stops it
 * dead: speed 0, recovering at once. Fastest is fixed and Lock is never
 * offered (v1.2 verification 1.4), so the mode is read here, not from the
 * Tower.
 */
export const stunBehaviour: TowerBehaviour<StunState> = {
  init(spec) {
    if (spec.mechanics.type !== "stun") throw new Error("stun behaviour on wrong tower");
    return { periodTicks: Math.round(spec.cooldown * TICKS_PER_SECOND) };
  },

  tick(tower, s, engine) {
    if (tower.cooldownTicks > 0) {
      tower.cooldownTicks -= 1;
      return;
    }
    const target = engine.pickTarget(tower, "fastest");
    if (target === null) {
      tower.targetId = null;
      return;
    }
    tower.targetId = target.id;
    tower.cooldownTicks = s.periodTicks - 1;
    engine.addBeam(tower.id, [target.id], 1);
    engine.slow(target, 0);
    engine.dealDamage(target, engine.damageAgainst(tower, target.type), tower.id);
  },
};
