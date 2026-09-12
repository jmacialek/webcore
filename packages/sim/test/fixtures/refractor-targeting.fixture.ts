import { createRun, original, switchback } from "../../src/index.js";
import { defineFixture } from "../helpers/fixtures.js";
import { at, must, stepTicks, stepUntil } from "../helpers/run.js";

/**
 * M1-07: Wave 1 on Switchback under Original with a Red Refractor on (3,0)
 * and, once its first Bounties afford it, a Green Laser 1 on (0,0). The
 * Refractor's Targeting Mode and Target Lock change mid-Wave; a lock
 * Command on the Laser is rejected (notLockable) and stays in the log.
 */
export default defineFixture("refractor-targeting", () => {
  const run = createRun({ ruleset: original, map: switchback, seed: 1 });
  must(run, { type: "sendWave" });
  must(run, { type: "placeTower", kind: "redRefractor", cell: { col: 3, row: 0 } }); // Tower 1, $200 of $275
  stepUntil(run, (s) => s.economy.bank >= 100, 3000);
  must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } }); // Tower 2
  run.apply(at(run, { type: "setTargetLock", towerId: 2, lock: false })); // rejected: notLockable
  stepTicks(run, 300);
  must(run, { type: "setTargetingMode", towerId: 1, mode: "weak" });
  stepTicks(run, 300);
  must(run, { type: "setTargetLock", towerId: 1, lock: false });
  stepTicks(run, 300);
  must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
  stepTicks(run, 300);
  must(run, { type: "setTargetLock", towerId: 1, lock: true });
  stepTicks(run, 3000 - run.tick);
  return run;
});
