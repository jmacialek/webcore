import { original, switchback } from "../../src/index.js";
import { defineFixture } from "../helpers/fixtures.js";
import { must, stepUntilEnded } from "../helpers/run.js";

/** M1-04: Wave 1 on Switchback with no Towers; every Leak costs a Life until defeat. */
export default defineFixture("no-towers-wave1-defeat", (createRun) => {
  const run = createRun({ ruleset: original, map: switchback, seed: 1 });
  must(run, { type: "sendWave" });
  stepUntilEnded(run, 20_000);
  return run;
});
