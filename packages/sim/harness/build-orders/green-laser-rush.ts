/**
 * Green Lasers upgraded along the first corner of Switchback. Row 4 Cells
 * border both the first straight (rows 2-3) and the return leg (rows 5-6),
 * so every Laser there covers two passes of both Lanes. Numbers: Green
 * Laser 1 $100, 2 $400, 3 $2000, a Rank costs half the base (towers 1.1).
 */
import type { BuildOrder } from "../harness.js";

export const greenLaserRush: BuildOrder = {
  name: "green-laser-rush",
  description: "Green Lasers along the first corner, each upgraded to max as the Bank allows.",
  ruleset: "original",
  steps: [
    { wave: 0, commands: [{ type: "placeTower", kind: "greenLaser1", cell: { col: 3, row: 1 } }, { type: "placeTower", kind: "greenLaser1", cell: { col: 4, row: 4 } }] },
    { wave: 2, commands: [{ type: "placeTower", kind: "greenLaser1", cell: { col: 6, row: 4 } }] },
    { wave: 3, commands: [{ type: "upgradeToMax", towerId: 1 }] },
    { wave: 4, commands: [{ type: "upgradeToMax", towerId: 2 }] },
    { wave: 5, commands: [{ type: "upgradeToMax", towerId: 3 }] },
    { wave: 6, commands: [{ type: "upgradeToMax", towerId: 1 }] },
    { wave: 7, commands: [{ type: "upgradeToMax", towerId: 2 }] },
    { wave: 8, commands: [{ type: "upgradeToMax", towerId: 3 }] },
    { wave: 9, commands: [{ type: "placeTower", kind: "greenLaser2", cell: { col: 8, row: 4 } }] },
    { wave: 10, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 11, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 12, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 13, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 14, commands: [{ type: "upgradeToMax", towerId: 4 }] },
    { wave: 18, commands: [{ type: "placeTower", kind: "greenLaser3", cell: { col: 10, row: 4 } }] },
    { wave: 20, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 22, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 24, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 26, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 28, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 30, commands: [{ type: "upgradeToMax", towerId: 5 }] },
    { wave: 33, commands: [{ type: "placeTower", kind: "greenLaser3", cell: { col: 5, row: 7 } }] },
    { wave: 35, commands: [{ type: "upgradeToMax", towerId: 6 }] },
    { wave: 37, commands: [{ type: "upgradeToMax", towerId: 6 }] },
    { wave: 39, commands: [{ type: "upgradeToMax", towerId: 6 }] },
    { wave: 41, commands: [{ type: "upgradeToMax", towerId: 6 }] },
    { wave: 43, commands: [{ type: "upgradeToMax", towerId: 6 }] },
    { wave: 45, commands: [{ type: "placeTower", kind: "greenLaser3", cell: { col: 8, row: 7 } }, { type: "upgradeToMax", towerId: 7 }] },
    { wave: 48, commands: [{ type: "upgradeToMax", towerId: 7 }] },
  ],
};
