import type { ProjectileBehaviour } from "./behaviour.js";

/** Stub until M1-10 lands. */
export const spamRocketBehaviour: ProjectileBehaviour = {
  tick(projectile) {
    throw new Error(`projectile behaviour 'spamRocket' is not implemented (projectile ${String(projectile.id)})`);
  },
};
