/**
 * Ruleset contract (CONTEXT.md: Ruleset, Tower, Tree, Tier, Rank, Range,
 * Targeting Mode, Target Lock, Vectoid, Wave, Bonus Wave, Bank, Interest,
 * Bounty, Score, Bonus Item, Booster).
 *
 * A Ruleset is data plus a few boolean rule variants. All constants are in
 * Cells and seconds (ADR 0002): every per-frame value from the v1.2 research
 * is converted once here at 40 original frames per second and 25 px per Cell.
 */

import type { MapTier } from "../map/types.js";

export type Tree = "green" | "red" | "purple" | "blue";

export type TowerKind =
  | "greenLaser1"
  | "greenLaser2"
  | "greenLaser3"
  | "redRefractor"
  | "littleRedSpammer"
  | "redRockets"
  | "purplePower1"
  | "purplePower2"
  | "purplePower3"
  | "blueRays1"
  | "blueRays2"
  | "blueFrostRockets";

/** Player-selectable Targeting Modes. */
export type SelectableMode = "close" | "hard" | "weak";
/** Every Targeting Mode, including the two fixed ones. */
export type TargetingMode = SelectableMode | "random" | "fastest";

export type VectoidType =
  | "redShredder"
  | "blueSpinner"
  | "greenFlyer"
  | "yellowSprinter"
  | "bigPurpleBox"
  | "hardGrey"
  | "bonusCell";

/** How a Tower fires. The engine dispatches on `type`. */
export type TowerMechanics =
  | {
      /** Continuous beam: `damage` lands `hitsPerSecond` times a second. */
      readonly type: "laser";
      readonly hitsPerSecond: number;
      /** Extra Vectoids hit, each within `chainRadius` of the previous victim. */
      readonly chainHops: 0 | 1 | 2;
      readonly chainRadius: number;
      /** Seconds to wait after losing a target before re-scanning. */
      readonly reacquireDelay: number;
    }
  | {
      /** Instant shot with splash to every Vectoid within `splashRadius`. */
      readonly type: "splashShot";
      readonly splashRadius: number;
      /** Fraction of damage at the edge of the splash radius (linear falloff). */
      readonly splashEdgeFraction: number;
    }
  | {
      /** Small rockets at random Vectoids; die without damage if target dies. */
      readonly type: "spam";
      readonly rocketSpeedMin: number;
      readonly rocketSpeedMax: number;
      readonly rocketAcceleration: number;
    }
  | {
      /** One homing rocket per shot; retargets nearest if target dies. */
      readonly type: "homingRocket";
      readonly rocketSpeedMax: number;
      readonly rocketAcceleration: number;
      /** Blue Frost Rockets only: slow every Vectoid near the impact. */
      readonly splashSlow?: {
        readonly radius: number;
        /** Speed becomes maxSpeed * factor. */
        readonly factor: number;
        /** Seconds before recovery begins. */
        readonly duration: number;
      };
    }
  | {
      /** Charge for `chargeSeconds`, then deal `hitsPerCycle` full hits. */
      readonly type: "chargeBeam";
      readonly chargeSeconds: number;
      readonly hitsPerCycle: number;
      /** Purple Power 3: target decelerates linearly to zero across the charge. */
      readonly slowsDuringCharge: boolean;
    }
  | {
      /** Blue Rays 1: hit up to `slots` Vectoids, unslowed first, and slow them. */
      readonly type: "multiSlow";
      readonly slots: number;
      /** Speed becomes min(current, maxSpeed * factor). */
      readonly factor: number;
    }
  | {
      /** Blue Rays 2: hit the fastest Vectoid and set its speed to zero. */
      readonly type: "stun";
    };

export interface TowerSpec {
  readonly kind: TowerKind;
  readonly displayName: string;
  readonly tree: Tree;
  readonly tier: 1 | 2 | 3;
  /** Base cost in dollars. */
  readonly cost: number;
  /** Base damage per hit. */
  readonly damage: number;
  /** Base Range in Cells. */
  readonly range: number;
  /** Seconds between shots (lasers: between hits; 1 / hitsPerSecond). */
  readonly cooldown: number;
  readonly defaultMode: TargetingMode;
  /** False for the Spammer (Random) and Blue Rays (Fastest). */
  readonly selectableModes: boolean;
  readonly lockable: boolean;
  readonly mechanics: TowerMechanics;
  /**
   * Dotted paths of fields whose values are placeholders awaiting the
   * balancing harness (M1-18). Absent or empty once tuned.
   */
  readonly placeholders?: readonly string[];
}

export interface VectoidSpec {
  readonly type: VectoidType;
  readonly displayName: string;
  /** Tree whose Towers deal 150% to it; undefined for colour-neutral types. */
  readonly colour?: Tree;
  /** Multiplier on base speed (Yellow Sprinter 2). */
  readonly speedMultiplier: number;
  /** Multiplier on the Wave's hit points (Bonus Cell 4). */
  readonly hpMultiplier: number;
  /** Multiplier applied to every hit taken (Hard Grey and Bonus Cell 0.75). */
  readonly damageTaken: number;
  /** True for the Bonus Cell: one Bonus Point on kill. */
  readonly awardsBonusPoint: boolean;
}

/** One entry of the fifty-entry Wave sequence. */
export type WaveEntry = VectoidType | "mixed";

export interface TierEconomy {
  readonly startBank: number;
  readonly startHp: number;
  readonly hpDivisor: number;
  readonly hpDivisorStep: number;
  /** Bounty at Wave n is n + bountyOffset. */
  readonly bountyOffset: number;
}

export interface Ruleset {
  readonly id: string;
  readonly version: string;
  readonly towers: readonly TowerSpec[];
  readonly vectoids: Readonly<Record<VectoidType, VectoidSpec>>;
  readonly waves: readonly WaveEntry[];
  /** Every this many Waves the last Vectoid of the last Lane is a Bonus Cell. */
  readonly bonusWaveEvery: number;
  readonly economy: {
    readonly lives: number;
    /** Starting Interest in percentage points. */
    readonly interest: number;
    readonly tiers: Readonly<Record<MapTier, TierEconomy>>;
    /** Send is available while alive Vectoids <= this. */
    readonly maxAliveToSend: number;
  };
  readonly scoring: {
    readonly killMultiplier: number;
    readonly leakMultiplier: number;
    readonly interestMultiplier: number;
  };
  readonly upgrade: {
    readonly maxRank: number;
    /** Each Rank costs trunc(cost / costDivisor). */
    readonly costDivisor: number;
    readonly damageDivisor: number;
    readonly rangeDivisor: number;
    /** Sell refunds trunc(spend / 100 * sellPercent). */
    readonly sellPercent: number;
  };
  readonly bonusItems: {
    readonly interestIncrease: number;
    readonly panicLives: number;
    readonly boosterPercent: number;
    readonly boosterRadius: number;
  };
  readonly movement: {
    /** Cells per second at speed multiplier 1. */
    readonly baseSpeed: number;
    /** Cells between consecutive Vectoids of a Lane at spawn. */
    readonly spawnSpacing: number;
    /** Cells per second squared of speed recovery after a slow. */
    readonly speedRecovery: number;
    readonly vectoidsPerLane: number;
  };
  readonly colourRule: {
    readonly sameColour: number;
    readonly oppositeColour: number;
  };
  readonly variants: {
    /** v1.2 bug: Blue Towers never apply their 50% and 75% penalties. */
    readonly blueTowersSkipPenalties: boolean;
  };
}

/** The explicit difference between Classic and Original (ADR 0001). */
export interface RulesetDiff {
  readonly id: string;
  readonly version: string;
  readonly variants?: Partial<Ruleset["variants"]>;
  readonly addTowers?: readonly TowerSpec[];
}
