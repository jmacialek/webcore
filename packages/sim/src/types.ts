/**
 * Public engine types: Commands in, Snapshots and Events out.
 *
 * Every value here is plain data and serialisable with JSON. Internal state
 * is never exported.
 */

import type { Cell, MapTier } from "./map/types.js";
import type {
  SelectableMode,
  TargetingMode,
  TowerKind,
  VectoidType,
  WaveEntry,
} from "./ruleset/types.js";

/** Fixed sim rate (ADR 0002). */
export const TICKS_PER_SECOND = 120;
/** Seconds per tick. */
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

export type BoosterKind = "damageBooster" | "rangeBooster";
export type InstantBonusItem = "interestIncrease" | "panic";

/** Player actions. Each applies at the start of `tick`, before movement. */
export type Command =
  | { readonly type: "placeTower"; readonly tick: number; readonly kind: TowerKind; readonly cell: Cell }
  | { readonly type: "upgrade"; readonly tick: number; readonly towerId: number }
  | { readonly type: "upgradeToMax"; readonly tick: number; readonly towerId: number }
  | { readonly type: "sell"; readonly tick: number; readonly towerId: number }
  | { readonly type: "setTargetingMode"; readonly tick: number; readonly towerId: number; readonly mode: SelectableMode }
  | { readonly type: "setTargetLock"; readonly tick: number; readonly towerId: number; readonly lock: boolean }
  | { readonly type: "sendWave"; readonly tick: number }
  | { readonly type: "setAuto"; readonly tick: number; readonly enabled: boolean }
  | { readonly type: "useBonusItem"; readonly tick: number; readonly item: InstantBonusItem }
  | { readonly type: "placeBooster"; readonly tick: number; readonly kind: BoosterKind; readonly cell: Cell };

export type CommandType = Command["type"];

export type RejectReason =
  | "runEnded"
  | "outOfOrderTick"
  | "unknownTowerKind"
  | "towerNotInRuleset"
  | "cellOffGrid"
  | "cellIsCorridor"
  | "cellOccupied"
  | "unaffordable"
  | "noSuchTower"
  | "maxRank"
  | "modeNotSelectable"
  | "notLockable"
  | "sendUnavailable"
  | "noBonusPoints"
  | "noSuchBooster"
  | "boosterNotSellable";

export type CommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RejectReason };

export interface EconomySnapshot {
  readonly bank: number;
  readonly lives: number;
  /** Interest in percentage points. */
  readonly interest: number;
  readonly score: number;
  readonly bonusPoints: number;
}

export interface NextWavePreview {
  readonly wave: number;
  readonly entry: WaveEntry;
  readonly displayName: string;
  readonly hp: number;
  readonly bounty: number;
  /** True when the Wave carries a Bonus Cell. */
  readonly bonus: boolean;
}

export interface WaveSnapshot {
  /** Number of the last Wave Sent; 0 before the first Send. */
  readonly current: number;
  readonly total: number;
  readonly alive: number;
  readonly canSend: boolean;
  readonly auto: boolean;
  /** Preview of the next Wave, or null once Wave 50 has been Sent. */
  readonly next: NextWavePreview | null;
}

export interface VectoidSnapshot {
  readonly id: number;
  readonly type: VectoidType;
  readonly wave: number;
  readonly lane: number;
  /** Distance along the Lane in Cells; negative while queued off-Grid. */
  readonly distance: number;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  /** Current speed in Cells per second. */
  readonly speed: number;
  readonly maxSpeed: number;
  readonly bounty: number;
}

export interface MaxUpgradeQuote {
  /** Ranks the Command would buy right now. */
  readonly ranks: number;
  /** Dollars it would spend. */
  readonly cost: number;
}

export interface TowerSnapshot {
  readonly id: number;
  readonly kind: TowerKind;
  readonly cell: Cell;
  readonly rank: number;
  /** Damage per hit after Boosters. */
  readonly damage: number;
  /** Range in Cells after Boosters. */
  readonly range: number;
  readonly baseDamage: number;
  readonly baseRange: number;
  readonly cooldown: number;
  readonly mode: TargetingMode;
  readonly selectableModes: boolean;
  readonly lockable: boolean;
  readonly lock: boolean;
  readonly targetId: number | null;
  /** Everything spent on this Tower so far. */
  readonly spend: number;
  readonly sellValue: number;
  /** Cost of the next single Rank, or null at max Rank. */
  readonly upgradeCost: number | null;
  readonly maxUpgrade: MaxUpgradeQuote;
  /** Percentage points of Damage Booster in effect. */
  readonly damageBuff: number;
  readonly rangeBuff: number;
}

export interface BoosterSnapshot {
  readonly id: number;
  readonly kind: BoosterKind;
  readonly cell: Cell;
}

export type ProjectileKind = "spamRocket" | "homingRocket";

export interface ProjectileSnapshot {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly towerId: number;
  readonly targetId: number | null;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
}

/** A beam drawn from a Tower to its victims this tick (lasers, Purple Powers). */
export interface BeamSnapshot {
  readonly towerId: number;
  readonly targetIds: readonly number[];
  /** Purple Powers: charge fraction 0..1; lasers: 1. */
  readonly charge: number;
}

export type RunOutcome = "victory" | "defeat";

export interface Snapshot {
  readonly tick: number;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly mapId: string;
  readonly tier: MapTier;
  readonly seed: number;
  readonly economy: EconomySnapshot;
  readonly wave: WaveSnapshot;
  readonly vectoids: readonly VectoidSnapshot[];
  readonly towers: readonly TowerSnapshot[];
  readonly boosters: readonly BoosterSnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly beams: readonly BeamSnapshot[];
  readonly outcome: RunOutcome | null;
}

export type SimEvent =
  | { readonly type: "spawned"; readonly tick: number; readonly vectoidId: number; readonly vectoidType: VectoidType; readonly wave: number; readonly lane: number }
  | { readonly type: "killed"; readonly tick: number; readonly vectoidId: number; readonly towerId: number; readonly bounty: number }
  | { readonly type: "leaked"; readonly tick: number; readonly vectoidId: number; readonly livesLeft: number }
  | { readonly type: "waveSent"; readonly tick: number; readonly wave: number }
  | { readonly type: "waveCleared"; readonly tick: number; readonly wave: number }
  | { readonly type: "interestPaid"; readonly tick: number; readonly amount: number; readonly scoreGained: number }
  | { readonly type: "towerPlaced"; readonly tick: number; readonly towerId: number; readonly kind: TowerKind; readonly cell: Cell }
  | { readonly type: "towerUpgraded"; readonly tick: number; readonly towerId: number; readonly rank: number; readonly cost: number }
  | { readonly type: "towerSold"; readonly tick: number; readonly towerId: number; readonly refund: number }
  | { readonly type: "bonusPointEarned"; readonly tick: number; readonly vectoidId: number }
  | { readonly type: "bonusItemUsed"; readonly tick: number; readonly item: InstantBonusItem | BoosterKind }
  | { readonly type: "boosterPlaced"; readonly tick: number; readonly boosterId: number; readonly kind: BoosterKind; readonly cell: Cell }
  | { readonly type: "runEnded"; readonly tick: number; readonly outcome: RunOutcome; readonly score: number };

export type SimEventType = SimEvent["type"];

/** A Command as recorded in the Command Log, with the result it had. */
export interface LoggedCommand {
  readonly command: Command;
  readonly result: CommandResult;
}

/** The complete, serialisable record of a Run (ADR 0003). */
export interface SerialisedRun {
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly mapId: string;
  readonly seed: number;
  readonly commands: readonly Command[];
  /** Ticks stepped in total. */
  readonly ticks: number;
}
