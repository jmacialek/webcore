import type { Engine } from "../engine.js";
import type { ProjectileState } from "../state.js";

/** How a projectile flies each tick. One behaviour per `ProjectileKind`. */
export interface ProjectileBehaviour {
  tick(projectile: ProjectileState, engine: Engine): void;
}
