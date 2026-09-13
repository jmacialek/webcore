import { createRun, original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks, stepUntil } from "../helpers/run.js";

/** Bank raised to afford a Little Red Spammer ($800) and Red Rockets ($2500) at once (towers research 1.1). */
const ruleset = overrideRuleset(original, { startBank: 5000, suffix: "red-projectiles" });

/**
 * M1-10: Waves 1 and 2 on Switchback under Original with a Little Red
 * Spammer on (3,0) and Red Rockets on (6,0), far enough from the Lanes that
 * two of its rockets are in flight at a time. Wave 2 (Red Shredders, the
 * Towers' own colour) is Sent as soon as the gate allows; the Rockets' lock
 * is turned off mid-Wave 2 so each rocket re-picks by Hard. Every Spammer
 * target and spawn point comes from the Seed.
 */
export default defineFixture(
  "red-projectiles",
  () => {
    const run = createRun({ ruleset, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "littleRedSpammer", cell: { col: 3, row: 0 } }); // Tower 1
    must(run, { type: "placeTower", kind: "redRockets", cell: { col: 6, row: 0 } }); // Tower 2
    stepUntil(run, (s) => s.wave.canSend, 3000);
    must(run, { type: "sendWave" });
    stepTicks(run, 600);
    must(run, { type: "setTargetLock", towerId: 2, lock: false });
    stepTicks(run, 3000 - run.tick);
    return run;
  },
  { rulesets: [ruleset] },
);
