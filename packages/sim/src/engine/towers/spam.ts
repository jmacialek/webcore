import { Engine } from "../engine.js";
import type { TowerBehaviour } from "./behaviour.js";
import type { RocketFlight } from "../projectiles/homingRocket.js";

interface SpamState {
  periodTicks: number;
  speedMin: number;
  flight: RocketFlight;
}

/**
 * Little Red Spammer: every cooldown, one small rocket at a uniformly random
 * Vectoid in Range, launched from a random point inside the Tower's Cell
 * (towers research 1.3). Both draws come from the Run's seeded generator, in
 * a fixed order (target, then x, then y) and only when there is a target
 * (spec "Determinism"). The mode is fixed to Random and there is no lock.
 */
export const spamBehaviour: TowerBehaviour<SpamState> = {
  init(spec) {
    if (spec.mechanics.type !== "spam") throw new Error("spam behaviour on wrong tower");
    const m = spec.mechanics;
    return {
      periodTicks: Engine.ticks(spec.cooldown),
      speedMin: m.rocketSpeedMin,
      flight: { tree: spec.tree, acceleration: m.rocketAcceleration, speedMax: m.rocketSpeedMax },
    };
  },

  tick(tower, s, engine) {
    const target = engine.pickTarget(tower, "random");
    if (target === null) return;
    const x = tower.cell.col + engine.rng.nextUnit();
    const y = tower.cell.row + engine.rng.nextUnit();
    engine.launchProjectile("spamRocket", tower, target, x, y, s.speedMin, s.flight);
    tower.cooldownTicks = s.periodTicks - 1;
  },
};
