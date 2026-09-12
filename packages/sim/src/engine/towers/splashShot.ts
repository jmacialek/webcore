import type { TowerBehaviour } from "./behaviour.js";
import { TICKS_PER_SECOND } from "../../types.js";
import { distanceSquared } from "../geometry.js";

interface SplashState {
  periodTicks: number;
  splashRadius: number;
  edgeFraction: number;
}

/**
 * Red Refractor: one instant shot per cooldown. The primary takes full
 * damage; every other Vectoid within `splashRadius` of it takes a linear
 * falloff from 100% at the primary to `edgeFraction` at the edge, all using
 * the primary's colour multiplier (towers research 1.3 and 2.1).
 */
export const splashShotBehaviour: TowerBehaviour<SplashState> = {
  init(spec) {
    if (spec.mechanics.type !== "splashShot") throw new Error("splashShot behaviour on wrong tower");
    return {
      periodTicks: Math.round(spec.cooldown * TICKS_PER_SECOND),
      splashRadius: spec.mechanics.splashRadius,
      edgeFraction: spec.mechanics.splashEdgeFraction,
    };
  },

  tick(tower, s, engine) {
    if (tower.cooldownTicks > 0) {
      tower.cooldownTicks -= 1;
      return;
    }
    const target = engine.resolveTarget(tower);
    if (target === null) return;
    tower.cooldownTicks = s.periodTicks - 1;
    const d = engine.damageAgainst(tower, target.type);
    const r = s.splashRadius;
    const r2 = r * r;
    // Collect victims before dealing damage so a kill mid-loop cannot change the set.
    const victims = engine.vectoidsWithin(target.x, target.y, r2);
    for (const v of victims) {
      if (v.id === target.id) {
        engine.dealDamage(v, d, tower.id);
        continue;
      }
      const dist = Math.sqrt(distanceSquared(v.x, v.y, target.x, target.y));
      const fraction = 1 - (1 - s.edgeFraction) * (dist / r);
      engine.dealDamage(v, d * fraction, tower.id);
    }
  },
};
