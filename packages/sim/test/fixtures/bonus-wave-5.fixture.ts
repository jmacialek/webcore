import { createRun, original, switchback, TICKS_PER_SECOND } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks } from "../helpers/run.js";

/** Every Wave at 1 hp (the Bonus Cell at 4) so single hits kill; nothing ends the Run; every Wave Sendable at once. */
const oneHp = overrideRuleset(original, { startHp: 1, lives: 100_000, maxAliveToSend: 100_000, suffix: "bonus-wave-5" });

/**
 * M1-08: the Wave 5 Bonus Wave on Switchback. Waves 1..4 are Sent at tick 0
 * and walked 15 s clear of the Entry; then Wave 5 is Sent with a Green Laser
 * 1 and a Red Refractor by the Entry, and the Run steps until the Bonus Cell
 * dies (bonusPointEarned) or 6000 ticks pass.
 */
export default defineFixture(
  "bonus-wave-5",
  () => {
    const run = createRun({ ruleset: oneHp, map: switchback, seed: 1 });
    for (let wave = 1; wave <= 4; wave += 1) must(run, { type: "sendWave" });
    stepTicks(run, 15 * TICKS_PER_SECOND);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } });
    must(run, { type: "placeTower", kind: "redRefractor", cell: { col: 3, row: 0 } });
    for (let i = 0; i < 6000; i += 1) {
      if (run.step().some((e) => e.type === "bonusPointEarned")) break;
    }
    return run;
  },
  { rulesets: [oneHp] },
);
