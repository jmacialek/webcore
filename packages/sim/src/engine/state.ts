/** Internal mutable state. Never exported from the package. */

import type { Cell } from "../map/types.js";
import type { TargetingMode, TowerKind, TowerSpec, VectoidSpec, VectoidType } from "../ruleset/types.js";
import type { BoosterKind, ProjectileKind } from "../types.js";

export interface VectoidState {
  readonly id: number;
  readonly type: VectoidType;
  readonly spec: VectoidSpec;
  readonly wave: number;
  readonly lane: number;
  readonly bounty: number;
  readonly maxHp: number;
  readonly maxSpeed: number;
  distance: number;
  x: number;
  y: number;
  hp: number;
  speed: number;
  /** Speed recovery is suspended until this tick (Blue Frost Rockets). */
  slowHoldUntilTick: number;
  alive: boolean;
}

export interface TowerState {
  readonly id: number;
  readonly kind: TowerKind;
  readonly spec: TowerSpec;
  readonly cell: Cell;
  /** Tower centre in Cells. */
  readonly cx: number;
  readonly cy: number;
  rank: number;
  spend: number;
  mode: TargetingMode;
  lock: boolean;
  targetId: number | null;
  /** Ticks until the Tower may act again. */
  cooldownTicks: number;
  damageBuff: number;
  rangeBuff: number;
  /** Behaviour-owned scratch state, created by the behaviour's init. */
  mech: unknown;
}

export interface BoosterState {
  readonly id: number;
  readonly kind: BoosterKind;
  readonly cell: Cell;
  readonly cx: number;
  readonly cy: number;
}

export interface ProjectileState {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly towerId: number;
  /** Damage per hit at launch, after Boosters. */
  readonly damage: number;
  targetId: number | null;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
  /** Behaviour-owned scratch state. */
  mech: unknown;
}
