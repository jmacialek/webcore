/**
 * Blue Frost Rockets: the Blue Tier 3 added by Classic (ADR 0001, item 2).
 *
 * New to this tribute, so there is no v1.2 source. Rocket flight copies Red
 * Rockets (towers 1.3). The numbers were set by the balancing harness
 * (M1-18, `harness/tune-frost.ts`): the Blue Tree is the slow Tree, so this
 * is a slow-first, damage-second Tower. Damage is a sixth of Red Rockets'
 * 30,000 but is paid to every Vectoid within 1.5 Cells of the impact (the
 * primary and its neighbours at the 0.8-Cell spawn spacing), and one rocket
 * every 3 s keeps Red Rockets the damage pick. The slow halves speed, which
 * brings a Yellow Sprinter (2x) down to ordinary walking pace, and holds
 * for 1 s before the +0.64 Cells/s^2 recovery (towers 1.3). At equal spend
 * the harness's frost-rockets build then survives about as many Waves as
 * red-rockets (25 against 24) with no Leaks on the Sprinter Waves it meets
 * (red-rockets Leaks 13 on Wave 22), and a build with both Tier 3s
 * outlasts either alone (36 Waves).
 */

import type { TowerSpec } from "./types.js";
import { cellsPerSecond, cellsPerSecondSquared } from "./units.js";

export const blueFrostRockets: TowerSpec = {
  kind: "blueFrostRockets",
  displayName: "Blue Frost Rockets",
  tree: "blue",
  tier: 3,
  cost: 2200,
  damage: 5000, // M1-18 harness: a sixth of Red Rockets, paid to every splash victim
  range: 6.0, // as Red Rockets (towers 1.1): the long-Range Tier 3
  cooldown: 3, // M1-18 harness: one rocket every 3 s
  defaultMode: "close",
  selectableModes: true, // CONTEXT.md: player-selectable Targeting Mode
  lockable: true,
  mechanics: {
    type: "homingRocket",
    rocketSpeedMax: cellsPerSecond(3), // as Red Rockets
    rocketAcceleration: cellsPerSecondSquared(0.1), // as Red Rockets
    splashSlow: {
      radius: 1.5, // M1-18 harness: the primary and its neighbours at 0.8-Cell spawn spacing
      factor: 1 / 2, // M1-18 harness: a Yellow Sprinter (2x, waves 1.1) drops to walking pace
      duration: 1, // M1-18 harness: seconds held before recovery (towers 1.3)
    },
  },
};
