import { createRun, original, switchback } from "../../src/index.js";
import { defineFixture, overrideRuleset } from "../helpers/fixtures.js";
import { must, stepUntil } from "../helpers/run.js";

/** One-hit Vectoids so a single Green Laser 1 clears each Wave on contact. */
const oneHit = overrideRuleset(original, { startHp: 1, suffix: "send-interest-auto" });

/**
 * M1-05: one Green Laser 1 beside the Entry, Auto on from tick 0. Auto Sends
 * Wave 1 at once, then Sends Waves 2, 3, and 4 on the tick each previous
 * Wave's last Vectoid dies, paying Interest at every Send after the first.
 * Stops the moment Wave 4 is Sent.
 */
export default defineFixture(
  "send-interest-auto",
  () => {
    const run = createRun({ ruleset: oneHit, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 3, row: 1 } });
    must(run, { type: "setAuto", enabled: true });
    stepUntil(run, (s) => s.wave.current === 4, 6000);
    return run;
  },
  { rulesets: [oneHit] },
);
