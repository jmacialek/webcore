/**
 * The Engine owns all mutable Run state and every rule that touches it.
 * Tower and projectile behaviours act on the world only through its
 * methods. Nothing here is exported from the package.
 */

import type { Cell, GameMap } from "../map/types.js";
import type { Ruleset, TargetingMode, TowerSpec, Tree, VectoidType } from "../ruleset/types.js";
import { waveComposition, waveTable } from "../ruleset/waves.js";
import type {
  BeamSnapshot,
  BoosterKind,
  MaxUpgradeQuote,
  ProjectileKind,
  RunOutcome,
  SimEvent,
} from "../types.js";
import { TICKS_PER_SECOND, TICK_SECONDS } from "../types.js";
import { distanceSquared } from "./geometry.js";
import { Prng } from "./prng.js";
import { projectileBehaviour } from "./projectiles/registry.js";
import type { BoosterState, ProjectileState, TowerState, VectoidState } from "./state.js";
import { towerBehaviour } from "./towers/registry.js";

const OPPOSITE: Readonly<Record<Tree, Tree>> = {
  green: "red",
  red: "green",
  purple: "blue",
  blue: "purple",
};

export interface EngineInputs {
  readonly ruleset: Ruleset;
  readonly map: GameMap;
  readonly seed: number;
}

export class Engine {
  readonly ruleset: Ruleset;
  readonly map: GameMap;
  readonly seed: number;
  readonly rng: Prng;
  /** Hit points and Bounty for Waves 1..50 on this Map's tier. */
  readonly waveTable: readonly { readonly hp: number; readonly bounty: number }[];

  tick = 0;
  bank: number;
  lives: number;
  interest: number;
  score = 0;
  bonusPoints = 0;
  wave = 0;
  auto = false;
  outcome: RunOutcome | null = null;

  /** Alive Vectoids in spawn order. */
  readonly vectoids: VectoidState[] = [];
  /** Towers in placement order. */
  readonly towers: TowerState[] = [];
  readonly boosters: BoosterState[] = [];
  /** Live projectiles in launch order. */
  readonly projectiles: ProjectileState[] = [];
  /** Beams drawn this tick. */
  beams: BeamSnapshot[] = [];

  /** Events for the tick being assembled. */
  readonly pendingEvents: SimEvent[] = [];

  #nextVectoidId = 1;
  #nextTowerId = 1;
  #nextBoosterId = 1;
  #nextProjectileId = 1;

  constructor(inputs: EngineInputs) {
    this.ruleset = inputs.ruleset;
    this.map = inputs.map;
    this.seed = inputs.seed;
    this.rng = new Prng(inputs.seed);
    const tier = this.ruleset.economy.tiers[this.map.tier];
    this.bank = tier.startBank;
    this.lives = this.ruleset.economy.lives;
    this.interest = this.ruleset.economy.interest;
    this.waveTable = waveTable(this.ruleset, this.map.tier);
  }

  // ---------------------------------------------------------------- queries

  get ended(): boolean {
    return this.outcome !== null;
  }

  get totalWaves(): number {
    return this.ruleset.waves.length;
  }

  get canSend(): boolean {
    return !this.ended && this.wave < this.totalWaves && this.vectoids.length <= this.ruleset.economy.maxAliveToSend;
  }

  findTower(id: number): TowerState | null {
    return this.towers.find((t) => t.id === id) ?? null;
  }

  findVectoid(id: number | null): VectoidState | null {
    if (id === null) return null;
    const v = this.vectoids.find((c) => c.id === id);
    return v?.alive ? v : null;
  }

  towerSpec(kind: string): TowerSpec | null {
    return this.ruleset.towers.find((t) => t.kind === kind) ?? null;
  }

  isCellOccupied(cell: Cell): boolean {
    return (
      this.towers.some((t) => t.cell.col === cell.col && t.cell.row === cell.row) ||
      this.boosters.some((b) => b.cell.col === cell.col && b.cell.row === cell.row)
    );
  }

  /** Damage per hit at the Tower's Rank, before Boosters. */
  baseDamage(tower: TowerState): number {
    const step = Math.trunc(tower.spec.damage / this.ruleset.upgrade.damageDivisor);
    return tower.spec.damage + (tower.rank - 1) * step;
  }

  /** Range in Cells at the Tower's Rank, before Boosters. Computed in original px so 70 + 9 * 3 = 97 px exactly. */
  baseRange(tower: TowerState): number {
    const basePx = Math.round(tower.spec.range * 25);
    const stepPx = Math.trunc(basePx / this.ruleset.upgrade.rangeDivisor);
    return (basePx + (tower.rank - 1) * stepPx) / 25;
  }

  buffedDamage(tower: TowerState): number {
    return (this.baseDamage(tower) * (100 + tower.damageBuff)) / 100;
  }

  buffedRange(tower: TowerState): number {
    return (this.baseRange(tower) * (100 + tower.rangeBuff)) / 100;
  }

  upgradeCost(tower: TowerState): number {
    return Math.trunc(tower.spec.cost / this.ruleset.upgrade.costDivisor);
  }

  sellValue(spend: number): number {
    return Math.trunc((spend / 100) * this.ruleset.upgrade.sellPercent);
  }

  /** What upgradeToMax would buy right now; the Command uses this same code. */
  quoteMaxUpgrade(tower: TowerState): MaxUpgradeQuote {
    const step = this.upgradeCost(tower);
    let ranks = 0;
    let cost = 0;
    while (tower.rank + ranks < this.ruleset.upgrade.maxRank && this.bank - cost >= step) {
      ranks += 1;
      cost += step;
    }
    return { ranks, cost };
  }

  /** The Wave that would be Sent next, or null when all have been Sent. */
  nextWave(): number | null {
    return this.wave < this.totalWaves ? this.wave + 1 : null;
  }

  // ------------------------------------------------------------- targeting

  /** Original: Vectoids off the 550x450 field are ignored by Towers. */
  onField(v: VectoidState): boolean {
    return v.x > 0 && v.x < this.map.cols && v.y > 0 && v.y < this.map.rows;
  }

  inRange(tower: TowerState, v: VectoidState): boolean {
    const r = this.buffedRange(tower);
    return this.onField(v) && distanceSquared(tower.cx, tower.cy, v.x, v.y) <= r * r;
  }

  /**
   * Single scan in spawn order with strict comparisons, so ties go to the
   * earliest-spawned Vectoid (towers research 3.1).
   */
  pickTarget(tower: TowerState, mode: TargetingMode): VectoidState | null {
    let best: VectoidState | null = null;
    let key = 0;
    const candidates: VectoidState[] = [];
    for (const v of this.vectoids) {
      if (!v.alive || !this.inRange(tower, v)) continue;
      switch (mode) {
        case "close": {
          const d2 = distanceSquared(tower.cx, tower.cy, v.x, v.y);
          if (best === null || d2 < key) {
            best = v;
            key = d2;
          }
          break;
        }
        case "hard":
          if (best === null || v.hp > key) {
            best = v;
            key = v.hp;
          }
          break;
        case "weak":
          if (best === null || v.hp < key) {
            best = v;
            key = v.hp;
          }
          break;
        case "fastest":
          if (best === null || v.speed > key) {
            best = v;
            key = v.speed;
          }
          break;
        case "random":
          candidates.push(v);
          break;
      }
    }
    if (mode === "random") {
      if (candidates.length === 0) return null;
      const chosen = candidates[this.rng.nextInt(candidates.length)];
      return chosen ?? null;
    }
    return best;
  }

  /** The Tower's held target if it is still alive and in Range, else null. */
  heldTarget(tower: TowerState): VectoidState | null {
    const v = this.findVectoid(tower.targetId);
    if (v === null || !this.inRange(tower, v)) return null;
    return v;
  }

  /**
   * Target for a firing cycle under Target Lock semantics: lock on holds the
   * current target until it dies or leaves Range; lock off re-picks by mode
   * every cycle (v1.2 verification 1.3).
   */
  resolveTarget(tower: TowerState): VectoidState | null {
    if (!tower.lock) tower.targetId = null;
    let v = this.heldTarget(tower);
    if (v === null) {
      v = this.pickTarget(tower, tower.mode);
      tower.targetId = v === null ? null : v.id;
    }
    return v;
  }

  /** Alive, on-field Vectoids within squared radius of a point, in spawn order. */
  vectoidsWithin(x: number, y: number, r2: number): VectoidState[] {
    const out: VectoidState[] = [];
    for (const v of this.vectoids) {
      if (v.alive && this.onField(v) && distanceSquared(x, y, v.x, v.y) <= r2) out.push(v);
    }
    return out;
  }

  /** Nearest alive on-field Vectoid within squared radius, excluding some. */
  nearestVectoid(x: number, y: number, r2: number, exclude: readonly VectoidState[]): VectoidState | null {
    let best: VectoidState | null = null;
    let bestD2 = 0;
    for (const v of this.vectoids) {
      if (!v.alive || !this.onField(v) || exclude.includes(v)) continue;
      const d2 = distanceSquared(x, y, v.x, v.y);
      if (d2 > r2) continue;
      if (best === null || d2 < bestD2) {
        best = v;
        bestD2 = d2;
      }
    }
    return best;
  }

  /** Nearest alive on-field Vectoid anywhere (rocket retargeting). */
  nearestVectoidAnywhere(x: number, y: number): VectoidState | null {
    return this.nearestVectoid(x, y, Number.POSITIVE_INFINITY, []);
  }

  // ---------------------------------------------------------------- damage

  /**
   * The colour rule (towers research 2.1): 150% to the Tower's own colour,
   * 50% to its opposite, 75% to Hard Grey and the Bonus Cell, applied after
   * Boosters using the primary target's type. Under the blue-bug variant
   * Blue Towers skip the two penalties (2.2).
   */
  damageMultiplier(tree: Tree, primaryType: VectoidType): number {
    const spec = this.ruleset.vectoids[primaryType];
    const skip = tree === "blue" && this.ruleset.variants.blueTowersSkipPenalties;
    if (spec.colour === tree) return this.ruleset.colourRule.sameColour;
    if (spec.colour === OPPOSITE[tree]) return skip ? 1 : this.ruleset.colourRule.oppositeColour;
    return skip ? 1 : spec.damageTaken;
  }

  /** Buffed damage per hit against a primary target of the given type. */
  damageAgainst(tower: TowerState, primaryType: VectoidType): number {
    return this.buffedDamage(tower) * this.damageMultiplier(tower.spec.tree, primaryType);
  }

  dealDamage(v: VectoidState, amount: number, towerId: number): void {
    if (!v.alive || this.ended) return;
    v.hp -= amount;
    if (v.hp <= 0) this.kill(v, towerId);
  }

  /** Set a Vectoid's speed; recovery resumes after `holdTicks`. */
  slow(v: VectoidState, speed: number, holdTicks = 0): void {
    v.speed = speed;
    v.slowHoldUntilTick = Math.max(v.slowHoldUntilTick, this.tick + holdTicks);
  }

  addBeam(towerId: number, targetIds: readonly number[], charge: number): void {
    this.beams.push({ towerId, targetIds, charge });
  }

  launchProjectile(
    kind: ProjectileKind,
    tower: TowerState,
    target: VectoidState | null,
    x: number,
    y: number,
    speed: number,
    mech: unknown,
  ): ProjectileState {
    const p: ProjectileState = {
      id: this.#nextProjectileId,
      kind,
      towerId: tower.id,
      damage: this.buffedDamage(tower),
      targetId: target === null ? null : target.id,
      x,
      y,
      speed,
      alive: true,
      mech,
    };
    this.#nextProjectileId += 1;
    this.projectiles.push(p);
    return p;
  }

  // ------------------------------------------------------------- lifecycle

  kill(v: VectoidState, towerId: number): void {
    v.alive = false;
    v.hp = 0;
    const idx = this.vectoids.indexOf(v);
    if (idx >= 0) this.vectoids.splice(idx, 1);
    this.bank += v.bounty;
    this.score += v.bounty * this.ruleset.scoring.killMultiplier;
    this.pendingEvents.push({ type: "killed", tick: this.tick, vectoidId: v.id, towerId, bounty: v.bounty });
    if (v.spec.awardsBonusPoint) {
      this.bonusPoints += 1;
      this.pendingEvents.push({ type: "bonusPointEarned", tick: this.tick, vectoidId: v.id });
    }
    if (this.vectoids.length === 0) {
      this.pendingEvents.push({ type: "waveCleared", tick: this.tick, wave: this.wave });
      if (this.wave >= this.totalWaves) {
        this.end("victory");
      } else if (this.auto && this.canSend) {
        this.send();
      }
    }
  }

  leak(v: VectoidState): void {
    this.lives -= 1;
    this.score = Math.max(0, this.score - v.bounty * this.ruleset.scoring.leakMultiplier);
    v.distance = 0;
    this.placeVectoid(v);
    this.pendingEvents.push({ type: "leaked", tick: this.tick, vectoidId: v.id, livesLeft: this.lives });
    if (this.lives <= 0) this.end("defeat");
  }

  end(outcome: RunOutcome): void {
    if (this.ended) return;
    this.outcome = outcome;
    this.pendingEvents.push({ type: "runEnded", tick: this.tick, outcome, score: this.score });
  }

  /** Send the next Wave: pay Interest after the first, then spawn 28 Vectoids. */
  send(): void {
    const wave = this.wave + 1;
    this.wave = wave;
    if (wave > 1) {
      // Written as v1.2 wrote it, int(bank / 100 * interest), not
      // trunc(bank * interest / 100): the two differ for a few hundred Banks
      // (e.g. $410 at 30% pays $122, not $123) and the original's answer is
      // the one veterans remember (waves-and-economy research 2). IEEE
      // doubles make it identical on every engine.
      const paid = Math.trunc((this.bank / 100) * this.interest);
      const scoreGained = Math.trunc((this.bank / 100) * (this.interest * this.ruleset.scoring.interestMultiplier));
      this.score += scoreGained;
      this.bank += paid;
      this.pendingEvents.push({ type: "interestPaid", tick: this.tick, amount: paid, scoreGained });
    }
    this.pendingEvents.push({ type: "waveSent", tick: this.tick, wave });
    const stats = this.waveTable[wave - 1];
    if (stats === undefined) throw new Error(`no Wave ${String(wave)} in the table`);
    const types = waveComposition(this.ruleset, wave);
    const perLane = this.ruleset.movement.vectoidsPerLane;
    for (let lane = 0; lane < this.map.lanes.length; lane += 1) {
      for (let i = 0; i < perLane; i += 1) {
        const type = types[lane * perLane + i];
        if (type === undefined) throw new Error("Wave composition shorter than the Lanes need");
        this.spawn(type, wave, lane, -i * this.ruleset.movement.spawnSpacing, stats.hp, stats.bounty);
      }
    }
  }

  spawn(type: VectoidType, wave: number, lane: number, distance: number, waveHp: number, bounty: number): void {
    const spec = this.ruleset.vectoids[type];
    const maxSpeed = this.ruleset.movement.baseSpeed * spec.speedMultiplier;
    const hp = waveHp * spec.hpMultiplier;
    const v: VectoidState = {
      id: this.#nextVectoidId,
      type,
      spec,
      wave,
      lane,
      bounty,
      maxHp: hp,
      maxSpeed,
      distance,
      x: 0,
      y: 0,
      hp,
      speed: maxSpeed,
      slowHoldUntilTick: 0,
      alive: true,
    };
    this.#nextVectoidId += 1;
    this.placeVectoid(v);
    this.vectoids.push(v);
    this.pendingEvents.push({ type: "spawned", tick: this.tick, vectoidId: v.id, vectoidType: type, wave, lane });
  }

  placeVectoid(v: VectoidState): void {
    const lane = this.map.lanes[v.lane];
    if (lane === undefined) throw new Error(`Map has no Lane ${String(v.lane)}`);
    const p = lane.positionAt(v.distance);
    v.x = p.x;
    v.y = p.y;
  }

  placeTower(spec: TowerSpec, cell: Cell): TowerState {
    const behaviour = towerBehaviour(spec.mechanics.type);
    const t: TowerState = {
      id: this.#nextTowerId,
      kind: spec.kind,
      spec,
      cell,
      cx: cell.col + 0.5,
      cy: cell.row + 0.5,
      rank: 1,
      spend: spec.cost,
      mode: spec.defaultMode,
      lock: spec.lockable,
      targetId: null,
      cooldownTicks: 0,
      damageBuff: 0,
      rangeBuff: 0,
      mech: behaviour.init(spec),
    };
    this.#nextTowerId += 1;
    this.towers.push(t);
    this.bank -= spec.cost;
    this.recomputeBuffs();
    this.pendingEvents.push({ type: "towerPlaced", tick: this.tick, towerId: t.id, kind: t.kind, cell });
    return t;
  }

  removeTower(tower: TowerState): void {
    const idx = this.towers.indexOf(tower);
    if (idx >= 0) this.towers.splice(idx, 1);
    this.recomputeBuffs();
  }

  placeBooster(kind: BoosterKind, cell: Cell): BoosterState {
    const b: BoosterState = { id: this.#nextBoosterId, kind, cell, cx: cell.col + 0.5, cy: cell.row + 0.5 };
    this.#nextBoosterId += 1;
    this.boosters.push(b);
    this.bonusPoints -= 1;
    this.recomputeBuffs();
    this.pendingEvents.push({ type: "boosterPlaced", tick: this.tick, boosterId: b.id, kind, cell });
    this.pendingEvents.push({ type: "bonusItemUsed", tick: this.tick, item: kind });
    return b;
  }

  /** Every Tower within the Booster radius gains 25 points per Booster, additively (towers research 1.4). */
  recomputeBuffs(): void {
    const r = this.ruleset.bonusItems.boosterRadius;
    const r2 = r * r;
    const pct = this.ruleset.bonusItems.boosterPercent;
    for (const t of this.towers) {
      let damageBuff = 0;
      let rangeBuff = 0;
      for (const b of this.boosters) {
        if (distanceSquared(t.cx, t.cy, b.cx, b.cy) < r2) {
          if (b.kind === "damageBooster") damageBuff += pct;
          else rangeBuff += pct;
        }
      }
      t.damageBuff = damageBuff;
      t.rangeBuff = rangeBuff;
    }
  }

  // ------------------------------------------------------------------ step

  /** Advance one tick. Commands for this tick were already applied. */
  step(): void {
    this.beams = [];
    if (this.ended) {
      this.tick += 1;
      return;
    }
    this.moveVectoids();
    this.tickTowers();
    this.tickProjectiles();
    this.tick += 1;
  }

  moveVectoids(): void {
    const dt = TICK_SECONDS;
    const recovery = this.ruleset.movement.speedRecovery * dt;
    // Iterate over a copy: a Leak may end the Run, but never removes a Vectoid.
    for (const v of this.vectoids.slice()) {
      if (this.ended) return;
      if (this.tick >= v.slowHoldUntilTick && v.speed < v.maxSpeed) {
        v.speed = Math.min(v.maxSpeed, v.speed + recovery);
      }
      v.distance += v.speed * dt;
      const lane = this.map.lanes[v.lane];
      if (lane === undefined) throw new Error(`Map has no Lane ${String(v.lane)}`);
      if (v.distance >= lane.length) {
        this.leak(v);
      } else {
        this.placeVectoid(v);
      }
    }
  }

  /** Every Tower with a running cooldown counts it down; the rest act. */
  tickTowers(): void {
    for (const t of this.towers.slice()) {
      if (this.ended) return;
      if (t.cooldownTicks > 0) {
        t.cooldownTicks -= 1;
        continue;
      }
      towerBehaviour(t.spec.mechanics.type).tick(t, t.mech, this);
    }
  }

  tickProjectiles(): void {
    for (const p of this.projectiles.slice()) {
      if (this.ended) return;
      if (p.alive) projectileBehaviour(p.kind).tick(p, this);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      if (p !== undefined && !p.alive) this.projectiles.splice(i, 1);
    }
  }

  /** Seconds a cooldown of `seconds` lasts in ticks. */
  static ticks(seconds: number): number {
    return Math.round(seconds * TICKS_PER_SECOND);
  }
}
