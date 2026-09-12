import type { TowerBehaviour } from "./behaviour.js";

/** Stub until its ticket lands. Placing this kind before then throws on tick. */
export const stunBehaviour: TowerBehaviour<null> = {
  init() {
    return null;
  },
  tick(tower) {
    throw new Error(`tower behaviour 'stun' is not implemented (tower ${String(tower.id)})`);
  },
};
