import { Engine } from "../engine.js";
import type { TowerBehaviour } from "./behaviour.js";
import type { HomingRocketMech } from "../projectiles/homingRocket.js";

interface HomingState {
  periodTicks: number;
  mech: HomingRocketMech;
}

/**
 * Red Rockets and Blue Frost Rockets: one homing rocket per cooldown from
 * the Tower centre, starting at rest (towers research 1.3). The target is
 * resolved under Target Lock semantics each shot, so lock off re-picks per
 * rocket (3.2). The rocket carries the Tree, acceleration, top speed, and
 * the optional splash slow so it needs nothing from the Tower after launch.
 */
export const homingRocketBehaviour: TowerBehaviour<HomingState> = {
  init(spec) {
    if (spec.mechanics.type !== "homingRocket") throw new Error("homingRocket behaviour on wrong tower");
    const m = spec.mechanics;
    const mech: HomingRocketMech = {
      tree: spec.tree,
      acceleration: m.rocketAcceleration,
      speedMax: m.rocketSpeedMax,
      ...(m.splashSlow === undefined ? {} : { splashSlow: m.splashSlow }),
    };
    return { periodTicks: Engine.ticks(spec.cooldown), mech };
  },

  tick(tower, s, engine) {
    const target = engine.resolveTarget(tower);
    if (target === null) return;
    engine.launchProjectile("homingRocket", tower, target, tower.cx, tower.cy, 0, s.mech);
    tower.cooldownTicks = s.periodTicks - 1;
  },
};
