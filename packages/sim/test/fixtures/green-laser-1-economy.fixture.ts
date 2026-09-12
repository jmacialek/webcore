import { createRun, original, switchback } from "../../src/index.js";
import { defineFixture } from "../helpers/fixtures.js";
import { must } from "../helpers/run.js";

/**
 * M1-06: one Green Laser 1 at (3,1) placed at tick 0 with Auto on, under
 * Original on Switchback. Runs until Wave 3 is Sent or 4000 ticks pass,
 * whichever comes first, so kills, Bounty, and Score are in the digests.
 */
export default defineFixture("green-laser-1-economy", () => {
  const run = createRun({ ruleset: original, map: switchback, seed: 1 });
  must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 3, row: 1 } }); // towers research 1.1: $100
  must(run, { type: "setAuto", enabled: true });
  for (let i = 0; i < 4000 && run.snapshot().wave.current < 3; i += 1) run.step();
  return run;
});
