import { createRun, original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks, stepUntil } from "../helpers/run.js";

/** Bank raised so Green Laser 2 ($400) and Green Laser 3 ($2000) are affordable at tick 0 (towers research 1.1). */
const rich = overrideRuleset(original, { startBank: 5000, suffix: "green-laser-chain" });

/**
 * M1-09: Green Laser 2 beside the Entry on (3,1) and Green Laser 3 outside
 * Lane 0's first corner on (0,5), placed at tick 0 under Original on
 * Switchback with a raised Bank. Wave 1 is Sent at once and Wave 2 as soon
 * as the Send gate opens, so chained beams, kills, Bounty, Interest, and the
 * quarter-second re-scan waits are all in the digests. Runs 3000 ticks.
 */
export default defineFixture(
  "green-laser-chain",
  () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser2", cell: { col: 3, row: 1 } }); // Tower 1
    must(run, { type: "placeTower", kind: "greenLaser3", cell: { col: 0, row: 5 } }); // Tower 2
    must(run, { type: "sendWave" });
    run.step();
    stepUntil(run, (s) => s.wave.canSend, 3000);
    must(run, { type: "sendWave" });
    stepTicks(run, 3000 - run.tick);
    return run;
  },
  { rulesets: [rich] },
);
