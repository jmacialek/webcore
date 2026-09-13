/**
 * Classic only: the `red-rockets` economy with Blue Frost Rockets in place
 * of Red Rockets, on the same Cells and the same upgrade schedule, so M1-18
 * can compare the two Tier 3s at equal spend.
 */
import type { BuildOrder } from "../harness.js";
import { refractorOpening, tier3Schedule } from "./red-rockets.js";

export const frostRockets: BuildOrder = {
  name: "frost-rockets",
  description: "The red-rockets economy with Blue Frost Rockets as the Tier 3 (Classic only).",
  ruleset: "classic",
  steps: [...refractorOpening, ...tier3Schedule("blueFrostRockets")],
};
