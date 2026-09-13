/**
 * M1-15: Blue Frost Rockets (numbers final since M1-18).
 * Decisions: ADR 0001 item 2 (Classic adds the Blue Tier 3: long Range,
 * splash slow on impact, selectable Targeting Mode; Original has no such
 * Tower); spec user stories 5, 11, 15, 35 ($2200, Close by default, Target
 * Lock defaulting on, rockets whose impact slows every Vectoid near it).
 * Flight copies Red Rockets (towers research 1.3: 0 -> 3 px/frame at
 * +0.1 px/frame^2, retargets the nearest Vectoid if its target dies);
 * damage follows the colour rule with the primary's multiplier for every
 * splash victim (towers research 2.1; under Classic Blue obeys the
 * penalties, ADR 0001 item 1); recovery after the slow is +0.64 Cells/s^2
 * (towers research 1.3). Damage, Range, cooldown, radius, factor, and
 * duration are the numbers M1-18 tuned with the balancing harness (ADR
 * 0001 item 2); the Ruleset no longer flags any placeholders.
 *
 * Geometry (red-projectiles.test.ts): Lane 0 walks down x = 1.6 and Lane 1
 * down x = 2.4; the leaders (1 and 15) come on field at tick 30 and a new
 * pair every 60 ticks, 0.8 Cells apart. A Tower on (6,0) (centre 6.5, 0.5)
 * is 4.9 Cells from Lane 0, so a rocket from rest flies about 170 ticks and
 * lands among four Vectoids per Lane, some of them beyond 1.5 Cells of the
 * impact. A Tower on (3,0) reaches both Lanes at once and its rocket lands
 * within 100 ticks. Scenario method from colour-rule.test.ts: Send Waves
 * 1..N-1 at tick 0, walk them 15 s, then Send Wave N and place the Tower.
 */
import { describe, expect, it } from "vitest";
import { classic, createRun, getTowerSpec, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { ProjectileSnapshot, Ruleset, Run, SelectableMode, Snapshot, TowerSnapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

const FROST_COST = 2200; // spec user story 35; ADR 0001 item 2
const FROST_DAMAGE = 5000; // ADR 0001 item 2 (M1-18): a sixth of Red Rockets, paid to every splash victim
const FROST_RANGE = 6; // ADR 0001 item 2: as Red Rockets, towers research 1.1
const FROST_COOLDOWN = 3; // ADR 0001 item 2 (M1-18)
const FROST_PERIOD_TICKS = FROST_COOLDOWN * TICKS_PER_SECOND; // 360 ticks
const SLOW_RADIUS = 1.5; // ADR 0001 item 2 (M1-18): Cells from the impact
const SLOW_FACTOR = 1 / 2; // ADR 0001 item 2 (M1-18): a Sprinter drops to walking pace
const SLOW_DURATION = 1; // ADR 0001 item 2 (M1-18): seconds the slow holds
const SLOW_HOLD_TICKS = SLOW_DURATION * TICKS_PER_SECOND; // 120 ticks
const HOMING_ROCKET_SPEED_MAX = 4.8; // spec Units and time: 3 px/frame
const ROCKET_ACCELERATION = 6.4; // towers research 1.3: 0.1 px/frame^2
const BASE_SPEED = 1.6; // waves research 1.1: 1 px/frame
const RECOVERY_PER_TICK = 0.64 / TICKS_PER_SECOND; // towers research 1.3: +0.01 px/frame per frame
const BR2_DAMAGE = 4000; // towers research 1.1 and Corrections
const GREEN_LASER_1_PER_TICK = (22 * 40) / TICKS_PER_SECOND; // towers research 1.1: 880 dps
const ORIGINAL_TOWER_COUNT = 11; // spec user story 5: eleven original Towers
const LEADERS_ENTER_TICK = 30;

/** M1-15 flagged six placeholder numbers; M1-18 made them final, so nothing is flagged. */
const PLACEHOLDER_FIELDS: readonly string[] = [];

/** A Cell by the Entry within Range of both Lanes' first Cells. */
const BY_THE_ENTRY = { col: 0, row: 0 } as const;
/** A Cell that reaches both Lanes at once; its rocket lands within 100 ticks. */
const NEAR_CELL = { col: 3, row: 0 } as const;
/** 4.9 Cells from Lane 0: a rocket from rest takes about 170 ticks to reach Lane 0's leader, well inside the 360-tick cooldown. */
const FAR_CELL = { col: 6, row: 0 } as const;
/**
 * Placing the Tower this late puts Wave 1's leaders 5 Cells down the Lanes
 * (Lane 0 has turned along y = 3.4) while newcomers still enter 0.8 apart,
 * so a rocket at the newest Vectoid lands with several beyond 1.5 Cells.
 */
const LATE_TICK = 400;

/** Nothing dies, nothing ends the Run, every Wave can be Sent at once, and every Tower is affordable. */
function sturdy(base: Ruleset, suffix: string): Ruleset {
  return overrideRuleset(base, { startBank: 100_000, startHp: 100_000, lives: 100_000, maxAliveToSend: 100_000, suffix });
}

const frost = sturdy(classic, "frost");
/** Bank raised to afford one Blue Frost Rockets ($2200) with Original hit points (a rocket kills a Wave 1 Spinner). */
const rich = overrideRuleset(classic, { startBank: 10_000, suffix: "frost-rich" });

function tower(s: Snapshot, id: number): TowerSnapshot {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no Tower ${String(id)} in the Snapshot`);
  return t;
}

function vectoid(s: Snapshot, id: number): VectoidSnapshot {
  const v = s.vectoids.find((x) => x.id === id);
  if (v === undefined) throw new Error(`no Vectoid ${String(id)} in the Snapshot`);
  return v;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

/** Hard as the spec defines it: the on-field Vectoid in Range with the most hit points, ties to the earliest spawned (spec user story 13). */
function hardPick(s: Snapshot, t: TowerSnapshot): number {
  let best: VectoidSnapshot | null = null;
  for (const v of s.vectoids) {
    if (!onField(v) || distance(t.cell.col + 0.5, t.cell.row + 0.5, v.x, v.y) > t.range) continue;
    if (best === null || v.hp > best.hp) best = v;
  }
  if (best === null) throw new Error("nothing in Range");
  return best.id;
}

/**
 * Send Waves 1..wave-1 at tick 0 and walk them `seconds` down the Lanes. 15 s
 * clears Range 6 of (3.5, 0.5) for Waves 1..5; once Wave 6's Yellow
 * Sprinters are out (3.2 Cells/s) they sit on Lane 0's run along y = 5.6
 * at 15 s, so later Waves walk 22 s: the Sprinters are then past y = 11.6
 * and the slower Waves' leaders are at (14.4, 5.6), 12 Cells away.
 */
function runWithEarlierWavesGone(ruleset: Ruleset, wave: number, seconds = 15): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  for (let w = 1; w < wave; w += 1) must(run, { type: "sendWave" });
  stepTicks(run, seconds * TICKS_PER_SECOND);
  return run;
}

/** Wave 1 Sent at tick 0 with the given Towers placed in order at `placeAtTick`. */
function runWith(ruleset: Ruleset, towers: readonly { readonly kind: "blueFrostRockets" | "greenLaser1" | "blueRays2"; readonly cell: { readonly col: number; readonly row: number } }[], placeAtTick = 0): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  must(run, { type: "sendWave" });
  stepTicks(run, placeAtTick);
  for (const t of towers) {
    expect(switchback.isBuildable(t.cell)).toBe(true);
    must(run, { type: "placeTower", kind: t.kind, cell: t.cell });
  }
  return run;
}

interface Impact {
  /** The Snapshot before the impact tick was stepped. */
  readonly before: Snapshot;
  /** The Snapshot after it: the rocket is gone and sits where the primary stands. */
  readonly after: Snapshot;
  readonly rocket: ProjectileSnapshot;
  readonly primary: VectoidSnapshot;
  /** On-field Vectoids within the splash radius of the impact, the primary included. */
  readonly near: readonly VectoidSnapshot[];
  /** On-field Vectoids beyond it. */
  readonly far: readonly VectoidSnapshot[];
}

/** Step until the first rocket lands (the first hit point lost anywhere) and sort the Vectoids by distance from the primary. */
function firstImpact(run: Run, maxTicks = 1200): Impact {
  let before = run.snapshot();
  stepUntil(
    run,
    (s) => {
      const hit = s.vectoids.some((v) => v.hp !== v.maxHp);
      if (!hit) before = s;
      return hit;
    },
    maxTicks,
  );
  const after = run.snapshot();
  const rocket = before.projectiles[0];
  if (rocket?.targetId === undefined || rocket.targetId === null) throw new Error("no rocket in flight before the impact");
  expect(before.projectiles).toHaveLength(1);
  expect(after.projectiles.some((p) => p.id === rocket.id)).toBe(false);
  const primary = vectoid(after, rocket.targetId);
  const near = after.vectoids.filter((v) => onField(v) && distance(primary.x, primary.y, v.x, v.y) <= SLOW_RADIUS);
  const far = after.vectoids.filter((v) => onField(v) && distance(primary.x, primary.y, v.x, v.y) > SLOW_RADIUS);
  return { before, after, rocket, primary, near, far };
}

describe("Blue Frost Rockets exists in Classic and not in Original (ADR 0001 item 2; spec user story 5)", () => {
  it("is placed on buildable Cells", () => {
    for (const cell of [BY_THE_ENTRY, NEAR_CELL, FAR_CELL]) expect(switchback.isBuildable(cell)).toBe(true);
  });

  it("Classic carries twelve Towers, the twelfth being the Blue Tier 3 at $2200 with a homing rocket and a splash slow; Original carries the eleven without it", () => {
    expect(classic.towers).toHaveLength(ORIGINAL_TOWER_COUNT + 1);
    expect(original.towers).toHaveLength(ORIGINAL_TOWER_COUNT);
    expect(getTowerSpec(original, "blueFrostRockets")).toBeUndefined();
    const spec = getTowerSpec(classic, "blueFrostRockets");
    expect(spec).toMatchObject({
      kind: "blueFrostRockets",
      tree: "blue",
      tier: 3,
      cost: FROST_COST,
      damage: FROST_DAMAGE,
      range: FROST_RANGE,
      cooldown: FROST_COOLDOWN,
      defaultMode: "close",
      selectableModes: true,
      lockable: true,
    });
    expect(spec?.mechanics).toEqual({
      type: "homingRocket",
      rocketSpeedMax: HOMING_ROCKET_SPEED_MAX,
      rocketAcceleration: ROCKET_ACCELERATION,
      splashSlow: { radius: SLOW_RADIUS, factor: SLOW_FACTOR, duration: SLOW_DURATION },
    });
    // Every other Tower is the same object in both Rulesets: Classic is Original plus a diff (spec user story 53).
    expect(classic.towers.slice(0, ORIGINAL_TOWER_COUNT)).toEqual(original.towers);
  });

  it("placing it under Original is rejected with towerNotInRuleset and changes nothing", () => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    const before = run.snapshot();
    const digest = run.digest();
    expect(run.apply(at(run, { type: "placeTower", kind: "blueFrostRockets", cell: NEAR_CELL }))).toEqual({ ok: false, reason: "towerNotInRuleset" });
    expect(run.snapshot()).toEqual(before);
    expect(run.digest()).toBe(digest);
    expect(run.tick).toBe(before.tick);
    const events = run.step();
    expect(eventsOfType(events, "towerPlaced")).toEqual([]);
    expect(run.snapshot().towers).toEqual([]);
    expect(run.snapshot().economy.bank).toBe(before.economy.bank);
    // The Cell is still free: an original Tower goes there.
    must(run, { type: "placeTower", kind: "greenLaser1", cell: NEAR_CELL });
  });

  it("placing it under Classic succeeds, costs 2200, and shows Close by default with lock on", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    const bankBefore = run.snapshot().economy.bank;
    expect(bankBefore).toBe(10_000);
    must(run, { type: "placeTower", kind: "blueFrostRockets", cell: NEAR_CELL });
    const events = run.step();
    expect(eventsOfType(events, "towerPlaced")).toEqual([{ type: "towerPlaced", tick: 0, towerId: 1, kind: "blueFrostRockets", cell: NEAR_CELL }]);
    const s = run.snapshot();
    expect(s.economy.bank).toBe(bankBefore - FROST_COST);
    expect(tower(s, 1)).toMatchObject({
      kind: "blueFrostRockets",
      cell: NEAR_CELL,
      damage: FROST_DAMAGE,
      range: FROST_RANGE,
      cooldown: FROST_COOLDOWN,
      spend: FROST_COST,
      mode: "close",
      selectableModes: true,
      lockable: true,
      lock: true,
      targetId: null,
    });
  });

  it("flags no placeholder numbers (M1-18 made them final), and neither does any other Tower in either Ruleset", () => {
    const spec = getTowerSpec(classic, "blueFrostRockets");
    expect(spec?.placeholders ?? []).toEqual(PLACEHOLDER_FIELDS);
    for (const t of [...classic.towers, ...original.towers]) {
      if (t.kind === "blueFrostRockets") continue;
      expect(t.placeholders ?? []).toEqual([]);
    }
  });
});

describe("the rocket's impact slows and damages every Vectoid within 1.5 Cells (ADR 0001 item 2; spec user story 35)", () => {
  it("launches one homingRocket from the Tower centre at rest every 360 ticks at the nearest Vectoid (Close), holding it by lock", () => {
    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: FAR_CELL }]);
    stepTicks(run, LEADERS_ENTER_TICK);
    expect(run.snapshot().projectiles).toEqual([]);
    run.step(); // tick 30: the leaders enter Range 6 of (6.5, 0.5) and the first rocket launches
    let s = run.snapshot();
    // Close: Lane 1's leader (15, x = 2.4) is nearer to the Tower than Lane 0's (1, x = 1.6).
    expect(s.projectiles.map((p) => ({ id: p.id, kind: p.kind, towerId: p.towerId, targetId: p.targetId }))).toEqual([{ id: 1, kind: "homingRocket", towerId: 1, targetId: 15 }]);
    expect(tower(s, 1).targetId).toBe(15);
    const first = s.projectiles[0];
    expect(first?.x).toBeCloseTo(FAR_CELL.col + 0.5, 3);
    expect(first?.y).toBeCloseTo(FAR_CELL.row + 0.5, 3);
    expect(first?.speed).toBeCloseTo(ROCKET_ACCELERATION / TICKS_PER_SECOND, 12);
    stepTicks(run, FROST_PERIOD_TICKS - 1);
    expect(run.snapshot().projectiles.filter((p) => p.id === 2)).toEqual([]);
    run.step(); // tick 390: the second rocket, still at the held target
    s = run.snapshot();
    expect(s.projectiles.map((p) => ({ id: p.id, targetId: p.targetId }))).toContainEqual({ id: 2, targetId: 15 });
    expect(tower(s, 1).targetId).toBe(15);
  });

  it("under Classic the primary (a Blue Spinner, 150%) and every Vectoid within 1.5 Cells lose 7500 and drop to maxSpeed / 2; those beyond keep full speed and hit points", () => {
    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }], LATE_TICK);
    const t = tower(run.snapshot(), 1);
    const { before, after, primary, near, far } = firstImpact(run);
    expect(primary.type).toBe("blueSpinner");
    expect(after.projectiles).toEqual([]);
    expect(near.map((v) => v.id)).toContain(primary.id);
    expect(near.length).toBeGreaterThan(2);
    expect(far.length).toBeGreaterThan(0);
    for (const v of near) {
      expect(v.speed).toBeCloseTo(v.maxSpeed * SLOW_FACTOR, 12);
      expect(v.speed).toBeCloseTo(BASE_SPEED / 2, 12);
      expect(vectoid(before, v.id).hp - v.hp).toBeCloseTo(t.damage * 1.5, 9);
      expect(vectoid(before, v.id).hp - v.hp).toBeCloseTo(FROST_DAMAGE * 1.5, 9);
    }
    for (const v of far) {
      expect(v.speed).toBe(v.maxSpeed);
      expect(v.hp).toBe(v.maxHp);
    }
    // Queued Vectoids off the Grid are never splash victims.
    for (const v of after.vectoids) {
      if (onField(v)) continue;
      expect(v.speed).toBe(v.maxSpeed);
      expect(v.hp).toBe(v.maxHp);
    }
  });

  it("the slow holds for 120 ticks with no recovery, then recovers by 0.64 / 120 per tick (towers research 1.3)", () => {
    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }], LATE_TICK);
    const { after, near, far } = firstImpact(run);
    expect(after.projectiles).toEqual([]); // no second rocket in flight to re-slow anyone
    // Sell the Tower so nothing slows the victims again while they hold and recover.
    must(run, { type: "sell", towerId: 1 });
    const slowed = near.map((v) => v.id);
    const held = near.map((v) => v.speed);
    // The impact tick and the 119 after it: every victim sits at exactly the slowed speed.
    for (let k = 1; k < SLOW_HOLD_TICKS; k += 1) {
      run.step();
      const s = run.snapshot();
      slowed.forEach((id, i) => {
        expect(vectoid(s, id).speed).toBe(held[i]);
      });
      for (const v of far) expect(vectoid(s, v.id).speed).toBe(v.maxSpeed);
    }
    // Tick 120 after the impact: recovery resumes.
    for (let k = 1; k <= 30; k += 1) {
      run.step();
      const s = run.snapshot();
      slowed.forEach((id, i) => {
        const h = held[i];
        if (h === undefined) throw new Error("unreachable");
        expect(vectoid(s, id).speed).toBeCloseTo(h + k * RECOVERY_PER_TICK, 9);
        expect(vectoid(s, id).speed).toBeLessThan(BASE_SPEED);
      });
    }
  });

  it("never speeds a Vectoid up: one stopped by Blue Rays 2 on the impact tick stays at 0, and the hold still lasts 120 ticks", () => {
    // Hard with every hit point equal: the rocket flies at Vectoid 1 (earliest spawned) and Blue Rays 2 (Fastest, ties to the earliest) stops it.
    const rehearsal = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }]);
    must(rehearsal, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    const { rocket, before } = firstImpact(rehearsal);
    expect(rocket.targetId).toBe(1);
    const impactTick = before.tick;

    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }]);
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    stepTicks(run, impactTick);
    expect(run.tick).toBe(impactTick);
    expect(run.snapshot().projectiles.map((p) => p.targetId)).toEqual([1]);
    // Placed on the impact tick, Blue Rays 2 (Tower 2) fires before the projectiles land.
    must(run, { type: "placeTower", kind: "blueRays2", cell: BY_THE_ENTRY });
    run.step();
    const s = run.snapshot();
    expect(s.beams).toEqual([{ towerId: 2, targetIds: [1], charge: 1 }]);
    expect(s.projectiles).toEqual([]);
    const stopped = vectoid(s, 1);
    // Both Blue hits at 150% on a Blue Spinner under Classic.
    expect(stopped.maxHp - stopped.hp).toBeCloseTo(BR2_DAMAGE * 1.5 + FROST_DAMAGE * 1.5, 9);
    expect(stopped.speed).toBe(0);
    // The other victims are at maxSpeed / 2 as usual.
    const others = s.vectoids.filter((v) => v.id !== 1 && onField(v) && distance(stopped.x, stopped.y, v.x, v.y) <= SLOW_RADIUS);
    expect(others.length).toBeGreaterThan(0);
    for (const v of others) expect(v.speed).toBeCloseTo(v.maxSpeed * SLOW_FACTOR, 12);

    // Blue Rays 2 alone would let it recover from the next tick; the rocket's hold keeps it at 0 for the duration.
    must(run, { type: "sell", towerId: 1 });
    must(run, { type: "sell", towerId: 2 });
    for (let k = 1; k < SLOW_HOLD_TICKS; k += 1) {
      run.step();
      expect(vectoid(run.snapshot(), 1).speed).toBe(0);
    }
    run.step();
    expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(RECOVERY_PER_TICK, 12);
  });

  const cases = [
    // Wave 1 is Blue Spinner: the Tree's own colour, 150%.
    { wave: 1, type: "blueSpinner", damage: 7500, walk: 15 },
    // Wave 2 is Red Shredder: no affinity with Blue, 100%.
    { wave: 2, type: "redShredder", damage: 5000, walk: 15 },
    // Wave 5 is Hard Grey: 75% from every Tower.
    { wave: 5, type: "hardGrey", damage: 3750, walk: 15 },
    // Wave 8 is Big Purple Box: the opposite colour, 50% under Classic (ADR 0001 item 1).
    { wave: 8, type: "bigPurpleBox", damage: 2500, walk: 22 },
  ] as const;

  it.each(cases)("deals $damage of 5000 to each of Wave $wave's $type near the impact (towers research 2.1)", ({ wave, type, damage, walk }) => {
    const run = runWithEarlierWavesGone(frost, wave, walk);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueFrostRockets", cell: NEAR_CELL });
    const { before, primary, near } = firstImpact(run);
    expect(primary.wave).toBe(wave);
    expect(primary.type).toBe(type);
    expect(near.length).toBeGreaterThan(1);
    for (const v of near) {
      expect(v.wave).toBe(wave);
      expect(vectoid(before, v.id).hp - v.hp).toBeCloseTo(damage, 9);
      expect(v.speed).toBeCloseTo(v.maxSpeed * SLOW_FACTOR, 12);
    }
  });

  it("splash victims take the primary's multiplier: Big Purple Boxes walking with a Blue Spinner primary lose 7500, not 2500", () => {
    // Waves 7 (Blue Spinners) and 8 Sent together spawn on the same spots and walk at the same speed, so Spinners and Boxes overlap.
    const run = runWithEarlierWavesGone(frost, 7, 22);
    must(run, { type: "sendWave" }); // Wave 7
    must(run, { type: "sendWave" }); // Wave 8
    must(run, { type: "placeTower", kind: "blueFrostRockets", cell: NEAR_CELL });
    // Weak: a Box has four times a Spinner's hit points, so Wave 7's Lane 0 leader (six Waves of 28 came first) is the primary.
    must(run, { type: "setTargetingMode", towerId: 1, mode: "weak" });
    const { before, primary, near } = firstImpact(run);
    expect(primary).toMatchObject({ id: 6 * 28 + 1, wave: 7, type: "blueSpinner" });
    const boxes = near.filter((v) => v.type === "bigPurpleBox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const v of near) expect(vectoid(before, v.id).hp - v.hp).toBeCloseTo(FROST_DAMAGE * 1.5, 9);
  });
});

describe("Targeting Mode and Target Lock Commands (spec user stories 11, 12, 15, 16)", () => {
  it("accepts Close, Hard, and Weak and shows the mode in the Snapshot", () => {
    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }]);
    const modes: SelectableMode[] = ["hard", "weak", "close"];
    for (const mode of modes) {
      expect(run.apply(at(run, { type: "setTargetingMode", towerId: 1, mode }))).toEqual({ ok: true });
      run.step();
      expect(tower(run.snapshot(), 1).mode).toBe(mode);
    }
  });

  it("accepts lock off and on and shows the lock in the Snapshot", () => {
    const run = runWith(frost, [{ kind: "blueFrostRockets", cell: NEAR_CELL }]);
    expect(tower(run.snapshot(), 1).lock).toBe(true);
    expect(run.apply(at(run, { type: "setTargetLock", towerId: 1, lock: false }))).toEqual({ ok: true });
    run.step();
    expect(tower(run.snapshot(), 1).lock).toBe(false);
    expect(run.apply(at(run, { type: "setTargetLock", towerId: 1, lock: true }))).toEqual({ ok: true });
    run.step();
    expect(tower(run.snapshot(), 1).lock).toBe(true);
  });

  it("lock off re-picks by Hard for every rocket: after the first rocket and a Green Laser 1 wear the first target down, the second rocket flies at a fresh Vectoid", () => {
    const scenario = (lock: boolean): Snapshot => {
      // Frost first (Tower 1) so it picks before the laser (Tower 2) lands its first hit.
      const run = runWith(frost, [
        { kind: "blueFrostRockets", cell: FAR_CELL },
        { kind: "greenLaser1", cell: BY_THE_ENTRY },
      ]);
      must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
      if (!lock) must(run, { type: "setTargetLock", towerId: 1, lock: false });
      stepTicks(run, LEADERS_ENTER_TICK + FROST_PERIOD_TICKS + 1);
      return run.snapshot();
    };
    // A rocket flies for about 170 ticks, so the first has landed on 1 before the second launches at tick 390.
    const held = scenario(true);
    expect(tower(held, 1)).toMatchObject({ mode: "hard", lock: true, targetId: 1 });
    expect(held.projectiles.map((p) => ({ id: p.id, targetId: p.targetId }))).toEqual([{ id: 2, targetId: 1 }]);
    expect(vectoid(held, 1).hp).toBeLessThan(100_000 - FROST_DAMAGE * 1.5);

    const free = scenario(false);
    expect(tower(free, 1)).toMatchObject({ mode: "hard", lock: false });
    // The laser has hit 1 since tick 30 and the first rocket landed on it, so Hard re-picks a Vectoid at full hit points: not 1.
    expect(vectoid(free, 1).hp).toBeLessThan(100_000 - FROST_DAMAGE * 1.5 - 100 * GREEN_LASER_1_PER_TICK);
    const fresh = hardPick(free, tower(free, 1));
    expect(fresh).not.toBe(1);
    expect(vectoid(free, fresh).hp).toBe(100_000);
    expect(free.projectiles.map((p) => ({ id: p.id, targetId: p.targetId }))).toEqual([{ id: 2, targetId: fresh }]);
  });
});
