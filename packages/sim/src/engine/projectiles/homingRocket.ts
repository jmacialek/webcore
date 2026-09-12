import type { ProjectileBehaviour } from "./behaviour.js";

/** Stub until M1-10 lands. */
export const homingRocketBehaviour: ProjectileBehaviour = {
  tick(projectile) {
    throw new Error(`projectile behaviour 'homingRocket' is not implemented (projectile ${String(projectile.id)})`);
  },
};
