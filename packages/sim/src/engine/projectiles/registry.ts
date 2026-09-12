import type { ProjectileKind } from "../../types.js";
import type { ProjectileBehaviour } from "./behaviour.js";
import { homingRocketBehaviour } from "./homingRocket.js";
import { spamRocketBehaviour } from "./spamRocket.js";

const registry: Record<ProjectileKind, ProjectileBehaviour> = {
  spamRocket: spamRocketBehaviour,
  homingRocket: homingRocketBehaviour,
};

export function projectileBehaviour(kind: ProjectileKind): ProjectileBehaviour {
  return registry[kind];
}
