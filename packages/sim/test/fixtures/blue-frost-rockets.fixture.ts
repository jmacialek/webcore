import { classic, createRun, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks, stepUntil } from "../helpers/run.js";

/** Bank raised to afford one Blue Frost Rockets ($2200; ADR 0001 item 2) at tick 0. */
const ruleset = overrideRuleset(classic, { startBank: 5000, suffix: "blue-frost-rockets" });

/**
 * M1-15: Waves 1 and 2 on Switchback under Classic (Original hit points, so
 * a 5000 x 1.5 rocket kills a Wave 1 Spinner) with a Blue Frost Rockets on
 * (3,0), where its rockets reach both Lanes and their splash slows the
 * pack. Wave 2 (Red Shredders, 100%) is Sent as soon as the gate allows;
 * the mode switches to Hard 600 ticks in and the lock is turned off
 * mid-Wave 2 so each rocket re-picks. Runs to tick 3000.
 */
export default defineFixture(
  "blue-frost-rockets",
  () => {
    const run = createRun({ ruleset, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueFrostRockets", cell: { col: 3, row: 0 } }); // Tower 1
    stepTicks(run, 600);
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    stepUntil(run, (s) => s.wave.canSend, 3000);
    must(run, { type: "sendWave" });
    stepTicks(run, 600);
    must(run, { type: "setTargetLock", towerId: 1, lock: false });
    stepTicks(run, 3000 - run.tick);
    return run;
  },
  { rulesets: [ruleset] },
);
