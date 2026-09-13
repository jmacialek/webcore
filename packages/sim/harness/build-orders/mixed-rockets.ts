/**
 * Classic only: the `red-rockets` economy with both Tier 3s. Red Rockets
 * goes down at Wave 15 as in `red-rockets`; the Ranks it would have bought
 * at Waves 17 and 19 (2 x $1,250) pay instead for one Blue Frost Rockets
 * ($2,200) at Wave 19, and the Rank schedule resumes from Wave 21
 * alternating between the two. Same money, same Cells, so M1-18 can check
 * that Red Rockets for damage plus Frost for slow beats either alone.
 */
import type { BuildOrder } from "../harness.js";
import { refractorOpening } from "./red-rockets.js";

export const mixedRockets: BuildOrder = {
  name: "mixed-rockets",
  description: "The red-rockets economy with Red Rockets at Wave 15 and one Blue Frost Rockets at Wave 19 (Classic only).",
  ruleset: "classic",
  steps: [
    ...refractorOpening,
    { wave: 15, commands: [{ type: "placeTower", kind: "redRockets", cell: { col: 5, row: 7 } }] },
    { wave: 19, commands: [{ type: "placeTower", kind: "blueFrostRockets", cell: { col: 8, row: 10 } }] },
    { wave: 21, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 23, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 25, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 27, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 29, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 31, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 33, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 35, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 37, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 39, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 42, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 45, commands: [{ type: "upgradeToMax", towerId: 5 }] },
  ],
};
