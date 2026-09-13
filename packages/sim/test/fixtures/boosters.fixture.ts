import { original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { at, must, stepTicks, stepUntil } from "../helpers/run.js";

/** One Vectoid per Lane at 1 hp (the Bonus Cell at 4), every Wave Sendable at once, a Bank for a few lasers; Lives stay at 20. */
const twoCells = overrideRuleset(original, { startHp: 1, startBank: 1000, maxAliveToSend: 100_000, vectoidsPerLane: 1, suffix: "boosters" });

/**
 * M1-14: Damage Booster and Range Booster. Under the one-Vectoid-per-Lane
 * Ruleset every Wave is two Vectoids and Lane 1's is the Bonus Cell on
 * Waves 5 and 10. A Green Laser 1 on (0,0) switched to Hard kills Waves
 * 1..10 one after another (about 650 ticks) for two Bonus Points. A Damage
 * Booster goes on (3,0), three Cells from the laser (buffed), and a Range
 * Booster on (4,0), exactly four Cells from it (not buffed: strict <). A
 * second laser on (5,0) sits inside both. A third placeBooster (no Bonus
 * Points left) and a sell of "Tower 1" after the first laser is sold
 * (noSuchTower: the Booster's id is not a Tower id) are rejected and stay
 * in the log. Waves 11 and 12 then walk into the buffed laser and the Run
 * steps on to tick 4000.
 */
export default defineFixture(
  "boosters",
  (createRun) => {
    const run = createRun({ ruleset: twoCells, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } }); // Tower 1
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    for (let wave = 1; wave <= 10; wave += 1) {
      must(run, { type: "sendWave" });
      stepUntil(run, (_s, e) => e.some((x) => x.type === "waveCleared"), 600);
    }
    must(run, { type: "placeBooster", kind: "damageBooster", cell: { col: 3, row: 0 } }); // Booster 1
    must(run, { type: "placeBooster", kind: "rangeBooster", cell: { col: 4, row: 0 } }); // Booster 2
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 5, row: 0 } }); // Tower 2
    run.apply(at(run, { type: "placeBooster", kind: "damageBooster", cell: { col: 6, row: 0 } })); // rejected: noBonusPoints
    stepTicks(run, 60);
    must(run, { type: "sell", towerId: 1 });
    run.apply(at(run, { type: "sell", towerId: 1 })); // rejected: noSuchTower (Booster 1 is not a Tower)
    must(run, { type: "sendWave" }); // Wave 11
    stepUntil(run, (_s, e) => e.some((x) => x.type === "waveCleared"), 2000);
    must(run, { type: "sendWave" }); // Wave 12
    stepTicks(run, 4000 - run.tick);
    return run;
  },
  { rulesets: [twoCells] },
);
