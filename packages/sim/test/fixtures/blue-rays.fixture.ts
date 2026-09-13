import { original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks, stepUntil } from "../helpers/run.js";

/**
 * Bank raised so Blue Rays 1 ($300) and Blue Rays 2 ($500) are both
 * affordable at tick 0 (towers research 1.1); the Send gate lifted so Waves
 * 2..6 can be Sent on one tick to bring the Yellow Sprinters in.
 */
const rich = overrideRuleset(original, { startBank: 1000, maxAliveToSend: 100_000, suffix: "blue-rays" });

/**
 * M1-11: Wave 1 (Blue Spinners) on Switchback under Original with a Blue
 * Rays 1 on (0,0) and a Blue Rays 2 on (3,0) by the Entry; once the Wave is
 * cleared or 1500 ticks pass, Wave 6 (Yellow Sprinters) is Sent against the
 * same two Towers and the Run steps to tick 3000. Covers the four-slot slow
 * with recovery, the fastest-Vectoid stun, and the blue-bug multipliers.
 */
export default defineFixture(
  "blue-rays",
  (createRun) => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays1", cell: { col: 0, row: 0 } }); // Tower 1
    must(run, { type: "placeTower", kind: "blueRays2", cell: { col: 3, row: 0 } }); // Tower 2
    try {
      stepUntil(run, (_s, e) => e.some((x) => x.type === "waveCleared"), 1500);
    } catch {
      // Wave 1 not cleared within 1500 ticks: carry on with Wave 6 anyway.
    }
    for (let wave = 2; wave <= 5; wave += 1) must(run, { type: "sendWave" });
    must(run, { type: "sendWave" }); // Wave 6
    stepTicks(run, 3000 - run.tick);
    return run;
  },
  { rulesets: [rich] },
);
