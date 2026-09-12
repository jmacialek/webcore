import type { TowerSpec } from "../../ruleset/types.js";
import type { Engine } from "../engine.js";
import type { TowerState } from "../state.js";

/**
 * How a Tower acts each tick. One behaviour per `TowerMechanics.type`.
 * Behaviours drive the Engine only through its public methods so that
 * targeting, the colour rule, and kills stay in one place.
 */
export interface TowerBehaviour<S = unknown> {
  init(spec: TowerSpec): S;
  tick(tower: TowerState, state: S, engine: Engine): void;
}
