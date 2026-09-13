/**
 * Red Refractors early, Red Rockets by Wave 15, then Rank upgrades. Row 4
 * Cells border two passes of both Lanes (rows 2-3 and 5-6); the Tier 3s go
 * on rows 7 and 10, where a 6.0 Range reaches four passes.
 */
import type { TowerKind } from "../../src/index.js";
import type { BuildOrder, BuildStep } from "../harness.js";

/** The economy shared with `frost-rockets`: Refractors, then saving for the Tier 3. */
export const refractorOpening: readonly BuildStep[] = [
  { wave: 0, commands: [{ type: "placeTower", kind: "redRefractor", cell: { col: 3, row: 1 } }] },
  { wave: 3, commands: [{ type: "placeTower", kind: "redRefractor", cell: { col: 4, row: 4 } }] },
  { wave: 4, commands: [{ type: "upgradeToMax", towerId: 1 }] },
  { wave: 5, commands: [{ type: "upgradeToMax", towerId: 2 }] },
  { wave: 6, commands: [{ type: "upgradeToMax", towerId: 1 }] },
  { wave: 7, commands: [{ type: "placeTower", kind: "redRefractor", cell: { col: 6, row: 4 } }] },
  { wave: 8, commands: [{ type: "upgradeToMax", towerId: 3 }] },
  { wave: 9, commands: [{ type: "upgradeToMax", towerId: 2 }] },
  // Waves 10-14 save for the Tier 3.
];

/**
 * The Tier 3 phase shared with `frost-rockets`: two Towers of `kind` (ids
 * 4 and 5) on the same Cells and the same upgrade schedule, so the two
 * Tier 3s can be compared at equal spend.
 */
export function tier3Schedule(kind: TowerKind): readonly BuildStep[] {
  return [
    { wave: 15, commands: [{ type: "placeTower", kind, cell: { col: 5, row: 7 } }] },
    { wave: 17, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 19, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 21, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 23, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 27, commands: [{ type: "placeTower", kind, cell: { col: 8, row: 10 } }] },
    { wave: 29, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 31, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 33, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 35, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 37, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 39, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 42, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 45, commands: [{ type: "upgradeToMax", towerId: 5 }] },
  ];
}

export const redRockets: BuildOrder = {
  name: "red-rockets",
  description: "Red Refractors early, Red Rockets by Wave 15, then Rank upgrades.",
  ruleset: "original",
  steps: [...refractorOpening, ...tier3Schedule("redRockets")],
};
