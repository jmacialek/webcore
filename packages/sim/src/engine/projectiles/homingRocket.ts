import type { Tree } from "../../ruleset/types.js";
import { TICK_SECONDS, TICKS_PER_SECOND } from "../../types.js";
import type { ProjectileState, VectoidState } from "../state.js";
import type { ProjectileBehaviour } from "./behaviour.js";

/** Flight parameters a rocket carries from the Tower that launched it. */
export interface RocketFlight {
  /** The launching Tower's Tree, for the colour rule (the Tower may be sold mid-flight). */
  readonly tree: Tree;
  /** Cells per second squared (towers research 1.3: 0.1 px/frame^2). */
  readonly acceleration: number;
  /** Cells per second. */
  readonly speedMax: number;
}

/** Blue Frost Rockets only: slow every Vectoid within `radius` of the impact. */
export interface SplashSlow {
  readonly radius: number;
  readonly factor: number;
  readonly duration: number;
}

export interface HomingRocketMech extends RocketFlight {
  readonly splashSlow?: SplashSlow;
}

/**
 * Accelerate, then fly straight at the target's current position. Returns
 * true when the rocket reaches it this tick, in which case it now sits on
 * the target. One Math.sqrt per tick, all else + - x / (spec "Determinism").
 */
export function flyTowards(p: ProjectileState, target: VectoidState, flight: RocketFlight): boolean {
  p.speed = Math.min(flight.speedMax, p.speed + flight.acceleration * TICK_SECONDS);
  const step = p.speed * TICK_SECONDS;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= step * step) {
    p.x = target.x;
    p.y = target.y;
    return true;
  }
  const d = Math.sqrt(d2);
  p.x += (dx / d) * step;
  p.y += (dy / d) * step;
  return false;
}

/**
 * Red Rockets and Blue Frost Rockets: a homing rocket that accelerates from
 * rest, retargets the nearest on-field Vectoid if its target dies, and
 * expires harmlessly if none remain (towers research 1.3). Impact deals the
 * launch damage x the colour multiplier of the launching Tower's Tree.
 * With `splashSlow` every Vectoid within the radius is slowed and takes the
 * same damage, using the primary's multiplier (towers research 2.1).
 */
export const homingRocketBehaviour: ProjectileBehaviour = {
  tick(p, engine) {
    const m = p.mech as HomingRocketMech;
    let target = engine.findVectoid(p.targetId);
    if (target === null) {
      target = engine.nearestVectoidAnywhere(p.x, p.y);
      if (target === null) {
        p.alive = false;
        return;
      }
      p.targetId = target.id;
    }
    if (!flyTowards(p, target, m)) return;
    p.alive = false;
    const damage = p.damage * engine.damageMultiplier(m.tree, target.type);
    const splash = m.splashSlow;
    if (splash === undefined) {
      engine.dealDamage(target, damage, p.towerId);
      return;
    }
    const holdTicks = Math.round(splash.duration * TICKS_PER_SECOND);
    // Collect victims before dealing damage so a kill mid-loop cannot change the set.
    const victims = engine.vectoidsWithin(p.x, p.y, splash.radius * splash.radius);
    // Never speed a Vectoid up: min(current, maxSpeed * factor), as Blue Rays 1 does.
    engine.slow(target, Math.min(target.speed, target.maxSpeed * splash.factor), holdTicks);
    engine.dealDamage(target, damage, p.towerId);
    for (const v of victims) {
      if (v.id === target.id) continue;
      engine.slow(v, Math.min(v.speed, v.maxSpeed * splash.factor), holdTicks);
      engine.dealDamage(v, damage, p.towerId);
    }
  },
};
