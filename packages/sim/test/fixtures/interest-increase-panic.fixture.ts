import { original, switchback, TICKS_PER_SECOND } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepTicks } from "../helpers/run.js";

/** Every Wave at 1 hp (the Bonus Cell at 4) so single hits kill; every Wave Sendable at once; Lives stay at 20. */
const oneHp = overrideRuleset(original, { startHp: 1, maxAliveToSend: 100_000, suffix: "interest-increase-panic" });

/**
 * M1-13: Interest Increase after a Bonus Cell kill. Waves 1..4 are Sent at
 * tick 0 and walked 15 s clear of the Entry; then Wave 5 is Sent with a
 * Green Laser 1 by the Entry switched to Hard, and the Run steps until the
 * Bonus Cell dies (bonusPointEarned). The Bonus Point buys Interest
 * Increase (3% -> 6%), a second purchase is rejected (noBonusPoints) and
 * stays in the log, then Wave 6 is Sent so the Interest is paid at 6% and
 * the Run walks on a second. About 2,800 ticks in all.
 */
export default defineFixture(
  "interest-increase-panic",
  (createRun) => {
    const run = createRun({ ruleset: oneHp, map: switchback, seed: 1 });
    for (let wave = 1; wave <= 4; wave += 1) must(run, { type: "sendWave" });
    stepTicks(run, 15 * TICKS_PER_SECOND);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } });
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    for (let i = 0; i < 3000; i += 1) {
      if (run.step().some((e) => e.type === "bonusPointEarned")) break;
    }
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    run.step();
    // Rejected: the single Bonus Point is spent. Logged all the same.
    run.apply({ type: "useBonusItem", item: "panic", tick: run.tick });
    must(run, { type: "sendWave" });
    stepTicks(run, TICKS_PER_SECOND);
    return run;
  },
  { rulesets: [oneHp] },
);
