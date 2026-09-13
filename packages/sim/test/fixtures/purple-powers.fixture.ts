import { original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks, stepUntil } from "../helpers/run.js";

/**
 * M1-12: all three Purple Powers on Switchback under Original hit points,
 * with the Bank raised to exactly afford them (PP3 $2800 + PP2 $900 + PP1
 * $300 = $4000; towers research 1.1). Purple Power 3 (Hard) and Purple
 * Power 2 (Close, so it takes the nearer Lane 1) sit by the Entry; Purple
 * Power 1 sits downstream on (6,4) over the first straight and picks off
 * what they let past. Wave 1, then Wave 2 as soon as the Send gate opens
 * (tick 862); Purple Power 1's lock and mode change mid-Wave. 3000 ticks.
 */
const ruleset = overrideRuleset(original, { startBank: 4000, suffix: "purple-fixture" });

export default defineFixture(
  "purple-powers",
  (createRun) => {
    const run = createRun({ ruleset, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "purplePower3", cell: { col: 0, row: 0 } }); // Tower 1
    must(run, { type: "placeTower", kind: "purplePower2", cell: { col: 3, row: 0 } }); // Tower 2
    must(run, { type: "placeTower", kind: "purplePower1", cell: { col: 6, row: 4 } }); // Tower 3
    must(run, { type: "setTargetingMode", towerId: 2, mode: "close" });
    stepUntil(run, (s) => s.wave.canSend, 3000);
    must(run, { type: "sendWave" });
    stepTicks(run, 300);
    must(run, { type: "setTargetLock", towerId: 3, lock: false });
    stepTicks(run, 300);
    must(run, { type: "setTargetingMode", towerId: 3, mode: "weak" });
    stepTicks(run, Math.max(0, 3000 - run.tick));
    return run;
  },
  { rulesets: [ruleset] },
);
