/**
 * Blue Frost Rockets: the Blue Tier 3 added by Classic (ADR 0001, item 2).
 *
 * New to this tribute, so there is no v1.2 source. Rocket flight copies Red
 * Rockets (towers 1.3); the balancing numbers are placeholders for M1-18 and
 * are listed in `placeholders` so the harness knows what it may tune.
 */

import type { TowerSpec } from "./types.js";
import { cellsPerSecond, cellsPerSecondSquared } from "./units.js";

export const blueFrostRockets: TowerSpec = {
  kind: "blueFrostRockets",
  displayName: "Blue Frost Rockets",
  tree: "blue",
  tier: 3,
  cost: 2200,
  damage: 3000,
  range: 6.0,
  cooldown: 1.5,
  defaultMode: "close",
  selectableModes: true, // CONTEXT.md: player-selectable Targeting Mode
  lockable: true,
  mechanics: {
    type: "homingRocket",
    rocketSpeedMax: cellsPerSecond(3), // as Red Rockets
    rocketAcceleration: cellsPerSecondSquared(0.1), // as Red Rockets
    splashSlow: {
      radius: 2,
      factor: 1 / 6, // as Blue Rays 1
      duration: 1,
    },
  },
  placeholders: [
    "damage",
    "range",
    "cooldown",
    "mechanics.splashSlow.radius",
    "mechanics.splashSlow.factor",
    "mechanics.splashSlow.duration",
  ],
};
