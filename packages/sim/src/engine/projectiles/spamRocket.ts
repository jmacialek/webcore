import type { ProjectileBehaviour } from "./behaviour.js";
import { flyTowards } from "./homingRocket.js";
import type { RocketFlight } from "./homingRocket.js";

/**
 * Little Red Spammer rocket: flies at its target, accelerating from
 * `rocketSpeedMin` to `rocketSpeedMax`, and self-destructs without damage
 * if the target dies (towers research 1.3). Impact deals the launch damage
 * x the colour multiplier of the launching Tower's Tree (2.1).
 */
export const spamRocketBehaviour: ProjectileBehaviour = {
  tick(p, engine) {
    const flight = p.mech as RocketFlight;
    const target = engine.findVectoid(p.targetId);
    if (target === null) {
      p.alive = false;
      return;
    }
    if (!flyTowards(p, target, flight)) return;
    p.alive = false;
    engine.dealDamage(target, p.damage * engine.damageMultiplier(flight.tree, target.type), p.towerId);
  },
};
