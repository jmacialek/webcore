import type { BuildOrder } from "../harness.js";
import { frostRockets } from "./frost-rockets.js";
import { greenLaserRush } from "./green-laser-rush.js";
import { redRockets } from "./red-rockets.js";

/** Every checked-in build order by CLI name. */
export const buildOrders: Readonly<Record<string, BuildOrder>> = {
  [greenLaserRush.name]: greenLaserRush,
  [redRockets.name]: redRockets,
  [frostRockets.name]: frostRockets,
};
