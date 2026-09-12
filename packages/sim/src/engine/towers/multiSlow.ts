import type { TowerBehaviour } from "./behaviour.js";

/** Stub until its ticket lands. Placing this kind before then throws on tick. */
export const multiSlowBehaviour: TowerBehaviour<null> = {
  init() {
    return null;
  },
  tick(tower) {
    throw new Error(`tower behaviour 'multiSlow' is not implemented (tower ${String(tower.id)})`);
  },
};
