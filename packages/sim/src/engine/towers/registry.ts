import type { TowerMechanics } from "../../ruleset/types.js";
import type { TowerBehaviour } from "./behaviour.js";
import { chargeBeamBehaviour } from "./chargeBeam.js";
import { homingRocketBehaviour } from "./homingRocket.js";
import { laserBehaviour } from "./laser.js";
import { multiSlowBehaviour } from "./multiSlow.js";
import { spamBehaviour } from "./spam.js";
import { splashShotBehaviour } from "./splashShot.js";
import { stunBehaviour } from "./stun.js";

const registry: Record<TowerMechanics["type"], TowerBehaviour> = {
  laser: laserBehaviour,
  splashShot: splashShotBehaviour,
  spam: spamBehaviour,
  homingRocket: homingRocketBehaviour,
  chargeBeam: chargeBeamBehaviour,
  multiSlow: multiSlowBehaviour,
  stun: stunBehaviour,
};

export function towerBehaviour(type: TowerMechanics["type"]): TowerBehaviour {
  return registry[type];
}
