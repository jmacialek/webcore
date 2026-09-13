/**
 * M1-12: Purple Powers 1, 2, and 3.
 * Numbers: towers research 1.1 (PP1 $300 / 2650, PP2 $900 / 8500 x 2 beams,
 * PP3 $2800 / 22000, Range 100 px = 4 Cells, 40 frames = 1 s per cycle),
 * 1.3 (30-frame charge = 0.75 s, then the full damage in one hit; PP2 is
 * exactly 2x; PP3 sets speed = maxSpeed x (100 - alpha) / 100 during the
 * charge; slowed Vectoids recover at 0.64 Cells/s^2), 2.1 (colour rule:
 * Purple deals 150% to Big Purple Box, 50% to Blue Spinner, 75% to Hard
 * Grey); v1.2 verification 1.3 (lock on holds, lock off re-picks by mode at
 * the start of every cycle; Purple retries the next frame when nothing is
 * in Range); towers research 3.3 (a beam aborts when its target leaves).
 *
 * Method (colour-rule.test.ts): under a test-only Ruleset with 100,000 hp
 * per Vectoid nothing dies, so every hit is a clean delta. To put Wave N in
 * front of a Tower, Send Waves 1..N-1 at tick 0 and walk them 15 s out of
 * reach, then Send Wave N and place the Purple Power on (0,0) by the Entry.
 *
 * Geometry: Lane 0 enters at (1.6, -0.4) walking down at 1.6 Cells/s, so
 * its leader (Vectoid 1) comes on field, and into the 4-Cell Range of a
 * Tower on (0,0), on tick 30. Lane 0 turns at (1.6, 3.4) and leaves that
 * Range at x = 3.26 on row 3, about 5.46 Cells along, on tick 409.
 *
 * Charge model: on charge tick k of 90 the beam's charge is (k + 1) / 90,
 * a linear ramp that reaches 1 on the boundary tick, when the hit lands.
 */
import { describe, expect, it } from "vitest";
import { createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Ruleset, Run, Snapshot, TowerKind, TowerSnapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Hit points raised so nothing dies; Bank raised to afford every Purple Power; every Wave can be Sent at once. */
const sturdy = overrideRuleset(original, {
  startHp: 100_000,
  startBank: 100_000,
  lives: 100_000,
  maxAliveToSend: 100_000,
  suffix: "purple",
});

const STURDY_HP = 100_000;

/** Original hit points (Wave 1: 550) with a Bank that affords a $300 Purple Power 1 (Original starts at $275). */
const originalHp = overrideRuleset(original, { startBank: 300, suffix: "purple-kill" });
const CYCLE_TICKS = TICKS_PER_SECOND; // towers research 1.1: next cycle 40 frames = 1 s after the previous start
const CHARGE_TICKS = (3 * TICKS_PER_SECOND) / 4; // towers research 1.3: 30 frames = 0.75 s = 90 ticks
const IDLE_TICKS = CYCLE_TICKS - CHARGE_TICKS; // 30 ticks of nothing after the hit
const PP1_DAMAGE = 2650; // towers research 1.1
const PP2_DAMAGE = 8500; // towers research 1.1: x 2 beams
const PP3_DAMAGE = 22_000; // towers research 1.1
const PURPLE_RANGE = 4; // towers research 1.1: 100 px
const PURPLE_VS_BLUE = 0.5; // towers research 2.1: opposite colour
const PURPLE_VS_PURPLE = 1.5; // towers research 2.1: own colour
const BASE_SPEED = 1.6; // towers research 1.3: 1 px/frame
const SPEED_RECOVERY = 0.64; // towers research 1.3: +0.01 px/frame per frame
const RECOVERY_PER_TICK = SPEED_RECOVERY / TICKS_PER_SECOND;
const FIRST_CHARGE_TICK = 30; // Vectoid 1 comes on field (see the header)
const BY_THE_ENTRY = { col: 0, row: 0 } as const;

/** Charge fraction shown on charge tick k (0-based) of a cycle. */
function chargeAt(k: number): number {
  return (k + 1) / CHARGE_TICKS;
}

function tower(s: Snapshot, id = 1): TowerSnapshot {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no Tower ${String(id)} in the Snapshot`);
  return t;
}

function vectoid(s: Snapshot, id: number): VectoidSnapshot {
  const v = s.vectoids.find((x) => x.id === id);
  if (v === undefined) throw new Error(`no Vectoid ${String(id)} in the Snapshot`);
  return v;
}

function targetOf(run: Run, towerId = 1): number | null {
  return tower(run.snapshot(), towerId).targetId;
}

function hasTarget(s: Snapshot): boolean {
  const id = s.towers[0]?.targetId;
  return id !== undefined && id !== null;
}

function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

function distanceFrom(t: TowerSnapshot, v: VectoidSnapshot): number {
  const dx = t.cell.col + 0.5 - v.x;
  const dy = t.cell.row + 0.5 - v.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Ids of the on-field Vectoids within the Tower's Range (towers research 3.3). */
function inRangeOf(s: Snapshot, t: TowerSnapshot): number[] {
  return s.vectoids.filter((v) => onField(v) && distanceFrom(t, v) <= t.range).map((v) => v.id);
}

/** Send Waves 1..wave-1 at tick 0 and walk them 15 s down the Lanes, then Send `wave` and place the Tower by the Entry. */
function purpleRun(kind: TowerKind, wave = 1, ruleset: Ruleset = sturdy): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  for (let w = 1; w < wave; w += 1) must(run, { type: "sendWave" });
  if (wave > 1) stepTicks(run, 15 * TICKS_PER_SECOND);
  must(run, { type: "sendWave" });
  must(run, { type: "placeTower", kind, cell: BY_THE_ENTRY });
  return run;
}

/** Step until the Tower names a target: the Snapshot after its first charge tick. */
function stepToFirstCharge(run: Run): Snapshot {
  stepUntil(run, hasTarget, 5 * TICKS_PER_SECOND);
  return run.snapshot();
}

describe("what the seam exposes (towers research 1.1; verification 1.1)", () => {
  it("is placed on a buildable Cell by the Entry", () => {
    expect(switchback.isBuildable(BY_THE_ENTRY)).toBe(true);
  });

  it.each([
    ["purplePower1", 300, PP1_DAMAGE],
    ["purplePower2", 900, PP2_DAMAGE],
    ["purplePower3", 2800, PP3_DAMAGE],
  ] as const)("%s costs $%i, deals %i per hit, Range 4, 1 s cooldown, Hard by default with lock on", (kind, cost, damage) => {
    const run = purpleRun(kind);
    expect(tower(run.snapshot())).toMatchObject({
      kind,
      damage,
      baseDamage: damage,
      range: PURPLE_RANGE,
      cooldown: 1,
      spend: cost,
      mode: "hard",
      selectableModes: true,
      lockable: true,
      lock: true,
      targetId: null,
    });
    expect(run.snapshot().economy.bank).toBe(STURDY_HP - cost);
  });
});

describe("the charge and the hit (towers research 1.3)", () => {
  it("Purple Power 1 starts charging the tick its first Vectoid comes into Range, having retried every tick before", () => {
    const run = purpleRun("purplePower1");
    stepTicks(run, FIRST_CHARGE_TICK);
    const before = run.snapshot();
    expect(before.tick).toBe(FIRST_CHARGE_TICK);
    expect(inRangeOf(before, tower(before))).toEqual([]);
    expect(targetOf(run)).toBeNull();
    expect(before.beams).toEqual([]);
    run.step();
    const after = run.snapshot();
    // Both Lanes' leaders enter together at full hit points; Hard's tie goes to 1, spawned first.
    expect(inRangeOf(after, tower(after))).toEqual([1, 15]);
    expect(targetOf(run)).toBe(1);
    expect(after.beams).toEqual([{ towerId: 1, targetIds: [1], charge: chargeAt(0) }]);
  });

  it("deals nothing for 89 ticks of a rising beam, then 2650 x 0.5 = 1325 to a Wave 1 Blue Spinner on the 90th, idles 30 ticks, and charges again on the same held target", () => {
    const run = purpleRun("purplePower1");
    const first = stepToFirstCharge(run);
    expect(first.tick).toBe(FIRST_CHARGE_TICK + 1);
    const id = targetOf(run);
    expect(id).toBe(1);
    expect(vectoid(first, 1).type).toBe("blueSpinner");
    // Charge ticks 0..88: the beam rises linearly and hit points never move.
    for (let k = 1; k < CHARGE_TICKS - 1; k += 1) {
      run.step();
      const s = run.snapshot();
      expect(vectoid(s, 1).hp).toBe(STURDY_HP);
      expect(s.beams).toEqual([{ towerId: 1, targetIds: [1], charge: chargeAt(k) }]);
      expect(targetOf(run)).toBe(1);
    }
    // Charge tick 89, the boundary: full charge and the whole hit in one tick.
    run.step();
    const boundary = run.snapshot();
    expect(boundary.tick).toBe(FIRST_CHARGE_TICK + CHARGE_TICKS);
    expect(boundary.beams).toEqual([{ towerId: 1, targetIds: [1], charge: 1 }]);
    expect(vectoid(boundary, 1).hp).toBeCloseTo(STURDY_HP - PP1_DAMAGE * PURPLE_VS_BLUE, 9);
    expect(vectoid(boundary, 1).hp).toBe(STURDY_HP - 1325);
    // Idle: no beam, no damage, the target still held.
    for (let i = 0; i < IDLE_TICKS; i += 1) {
      run.step();
      const s = run.snapshot();
      expect(s.beams).toEqual([]);
      expect(vectoid(s, 1).hp).toBe(STURDY_HP - 1325);
      expect(targetOf(run)).toBe(1);
    }
    // One second after the first charge tick the next cycle begins on the held target.
    run.step();
    const second = run.snapshot();
    expect(second.tick).toBe(FIRST_CHARGE_TICK + CYCLE_TICKS + 1);
    expect(second.beams).toEqual([{ towerId: 1, targetIds: [1], charge: chargeAt(0) }]);
    expect(vectoid(second, 1).hp).toBe(STURDY_HP - 1325);
    // Its hit lands exactly one cycle after the first.
    stepTicks(run, CHARGE_TICKS - 1);
    expect(run.snapshot().tick).toBe(FIRST_CHARGE_TICK + CYCLE_TICKS + CHARGE_TICKS);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - 2 * 1325);
  });

  const colourCases = [
    // Wave 8 is Big Purple Box: the Tree's own colour, 150%.
    { wave: 8, type: "bigPurpleBox", multiplier: PURPLE_VS_PURPLE, hit: 3975 },
    // Wave 2 is Red Shredder: no affinity with Purple, 100%.
    { wave: 2, type: "redShredder", multiplier: 1, hit: 2650 },
    // Wave 1 is Blue Spinner: the opposite colour, 50%.
    { wave: 1, type: "blueSpinner", multiplier: PURPLE_VS_BLUE, hit: 1325 },
    // Wave 5 is Hard Grey: 75% from every Tower.
    { wave: 5, type: "hardGrey", multiplier: 0.75, hit: 1987.5 },
  ] as const;

  it.each(colourCases)("Purple Power 1 lands $hit (2650 x $multiplier) on Wave $wave's $type, 90 ticks after the charge began (towers research 2.1)", ({ wave, type, multiplier, hit }) => {
    const run = purpleRun("purplePower1", wave);
    const first = stepToFirstCharge(run);
    const id = targetOf(run);
    if (id === null) throw new Error("no target");
    // Wave N's hit points grow from the 100,000 base (waves research 1.2); untouched so far.
    const { maxHp } = vectoid(first, id);
    expect(vectoid(first, id)).toMatchObject({ wave, type, hp: maxHp });
    expect(maxHp).toBeGreaterThanOrEqual(STURDY_HP);
    const events = stepUntil(run, (s) => vectoid(s, id).hp < maxHp, 2 * CYCLE_TICKS);
    expect(eventsOfType(events, "killed")).toEqual([]);
    const s = run.snapshot();
    expect(s.tick - first.tick).toBe(CHARGE_TICKS - 1);
    expect(maxHp - vectoid(s, id).hp).toBeCloseTo(PP1_DAMAGE * multiplier, 9);
    expect(maxHp - vectoid(s, id).hp).toBeCloseTo(hit, 9);
  });

  it("under Original hit points the hit kills a 550 hp Blue Spinner outright: one killed Event on the boundary tick, then the next cycle picks anew", () => {
    const run = purpleRun("purplePower1", 1, originalHp);
    stepToFirstCharge(run);
    expect(targetOf(run)).toBe(1);
    const events = stepTicks(run, CHARGE_TICKS - 1);
    expect(eventsOfType(events, "killed")).toEqual([
      { type: "killed", tick: FIRST_CHARGE_TICK + CHARGE_TICKS - 1, vectoidId: 1, towerId: 1, bounty: 5 },
    ]);
    expect(targetOf(run)).toBeNull();
    stepTicks(run, IDLE_TICKS);
    expect(targetOf(run)).toBeNull();
    run.step();
    expect(targetOf(run)).not.toBeNull();
    expect(targetOf(run)).not.toBe(1);
  });
});

describe("Purple Power 2 fires two beams at the same target (towers research 1.3)", () => {
  it("lands 2 x 8500 x 0.5 = 8500 on a Wave 1 Blue Spinner in one tick, nothing before, and 2 x 8500 / 2650 times Purple Power 1's hit", () => {
    const pp1 = purpleRun("purplePower1");
    const pp2 = purpleRun("purplePower2");
    for (const run of [pp1, pp2]) {
      const first = stepToFirstCharge(run);
      expect(first.tick).toBe(FIRST_CHARGE_TICK + 1);
      expect(targetOf(run)).toBe(1);
      stepTicks(run, CHARGE_TICKS - 2);
      expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP);
      run.step();
    }
    const lostTo1 = STURDY_HP - vectoid(pp1.snapshot(), 1).hp;
    const lostTo2 = STURDY_HP - vectoid(pp2.snapshot(), 1).hp;
    expect(lostTo1).toBe(PP1_DAMAGE * PURPLE_VS_BLUE);
    expect(lostTo2).toBe(2 * PP2_DAMAGE * PURPLE_VS_BLUE);
    expect(lostTo2).toBe(8500);
    expect(lostTo2 / lostTo1).toBeCloseTo(2 * (PP2_DAMAGE / PP1_DAMAGE), 9);
    // Both beams are one hit on the Snapshot: a single beam at full charge.
    expect(pp2.snapshot().beams).toEqual([{ towerId: 1, targetIds: [1], charge: 1 }]);
  });

  it("Purple Power 3 lands 22000 x 0.5 = 11000 on the boundary tick", () => {
    const run = purpleRun("purplePower3");
    stepToFirstCharge(run);
    stepTicks(run, CHARGE_TICKS - 2);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP);
    run.step();
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - PP3_DAMAGE * PURPLE_VS_BLUE);
  });
});

describe("Purple Power 3 slows its target during the charge (towers research 1.3)", () => {
  it("sets speed to 1.6 x (1 - charge) on every charge tick, reaching 0 on the boundary tick, then the Vectoid recovers at 0.64 Cells/s^2", () => {
    const run = purpleRun("purplePower3");
    const first = stepToFirstCharge(run);
    expect(targetOf(run)).toBe(1);
    expect(vectoid(first, 1).maxSpeed).toBe(BASE_SPEED);
    const speeds: number[] = [vectoid(first, 1).speed];
    for (let k = 1; k < CHARGE_TICKS; k += 1) {
      run.step();
      speeds.push(vectoid(run.snapshot(), 1).speed);
    }
    for (const k of [0, 45, 89]) expect(speeds[k]).toBeCloseTo(BASE_SPEED * (1 - chargeAt(k)), 9);
    for (let k = 0; k < CHARGE_TICKS; k += 1) expect(speeds[k]).toBeCloseTo(BASE_SPEED * (1 - chargeAt(k)), 9);
    expect(speeds[CHARGE_TICKS - 1]).toBe(0);
    // Linear: every step down is the same 1.6 / 90.
    for (let k = 1; k < CHARGE_TICKS; k += 1) expect((speeds[k - 1] ?? NaN) - (speeds[k] ?? NaN)).toBeCloseTo(BASE_SPEED / CHARGE_TICKS, 9);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - PP3_DAMAGE * PURPLE_VS_BLUE);
    // Recovery during the idle ticks: +0.64 / 120 per tick from 0.
    for (let i = 1; i <= IDLE_TICKS; i += 1) {
      run.step();
      expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(i * RECOVERY_PER_TICK, 9);
    }
    // The next cycle's first charge tick pulls it straight back down to 1.6 x (1 - 1/90).
    run.step();
    expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(BASE_SPEED * (1 - chargeAt(0)), 9);
  });

  it("Purple Power 1 leaves its target at full speed throughout", () => {
    const run = purpleRun("purplePower1");
    stepToFirstCharge(run);
    for (let k = 1; k < CHARGE_TICKS + IDLE_TICKS; k += 1) {
      run.step();
      expect(vectoid(run.snapshot(), 1).speed).toBe(BASE_SPEED);
    }
  });

  it("setTargetingMode mid-charge aborts the charge: no beam that tick and no hit, then a new cycle picks by the new mode", () => {
    const run = purpleRun("purplePower3");
    stepToFirstCharge(run);
    stepTicks(run, 44);
    expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(BASE_SPEED * (1 - chargeAt(44)), 9);
    must(run, { type: "setTargetingMode", towerId: 1, mode: "close" });
    expect(targetOf(run)).toBeNull();
    run.step(); // the aborted cycle ends; nothing picked this tick
    expect(run.snapshot().beams).toEqual([]);
    expect(targetOf(run)).toBeNull();
    run.step(); // a new cycle picks by Close: the slowed 1 has lagged by the Entry and is the nearest
    expect(targetOf(run)).toBe(1);
    expect(run.snapshot().beams).toEqual([{ towerId: 1, targetIds: [1], charge: chargeAt(0) }]);
    stepTicks(run, CHARGE_TICKS - 1);
    // Only the new cycle's hit lands: one hit, not two.
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - PP3_DAMAGE * PURPLE_VS_BLUE);
  });

  it("a slowed target recovers fully once Purple Power 3 is Sold mid-charge: speed climbs at 0.64 Cells/s^2 to 1.6 and stays", () => {
    const run = purpleRun("purplePower3");
    stepToFirstCharge(run);
    stepTicks(run, 44);
    const slowed = vectoid(run.snapshot(), 1).speed;
    expect(slowed).toBeCloseTo(BASE_SPEED * (1 - chargeAt(44)), 9);
    must(run, { type: "sell", towerId: 1 });
    const ticksToFull = Math.ceil((BASE_SPEED - slowed) / RECOVERY_PER_TICK);
    for (let i = 1; i < ticksToFull; i += 1) {
      run.step();
      expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(Math.min(BASE_SPEED, slowed + i * RECOVERY_PER_TICK), 9);
    }
    stepTicks(run, CYCLE_TICKS);
    expect(vectoid(run.snapshot(), 1).speed).toBe(BASE_SPEED);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP);
    expect(run.snapshot().towers).toEqual([]);
  });
});

describe("Target Lock across cycles (v1.2 verification 1.3; towers research 3.2)", () => {
  /**
   * With lock off, Hard is re-run at the start of every cycle. The Tower's
   * own hits spread the hit points: whoever it just hit is no longer the
   * healthiest, so each cycle moves to the earliest-spawned untouched
   * Vectoid in Range. A Green Laser 1 on (3,0) (Close, holds by
   * construction) shaves Lane 1's leader 15 from tick 30 on, so 15 is never
   * the Hard answer even though it ties on spawn order with nobody.
   */
  function spreadRun(lock: boolean): Run {
    const run = purpleRun("purplePower1");
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 3, row: 0 } });
    must(run, { type: "setTargetLock", towerId: 1, lock });
    return run;
  }

  /**
   * The Purple Power's target on each cycle start, with the healthiest
   * Vectoid in Range at that pick. Movement precedes Towers in a tick and
   * the Purple Power (Tower 1) acts before the Laser, so the Snapshot after
   * the step holds the positions the pick saw; hit points in it differ only
   * by that tick's Laser damage to 15, which never makes 15 the healthiest.
   */
  function picks(run: Run, cycles: number): { readonly picked: number; readonly healthiest: number }[] {
    const out: { picked: number; healthiest: number }[] = [];
    stepTicks(run, FIRST_CHARGE_TICK);
    for (let c = 0; c < cycles; c += 1) {
      run.step();
      const after = run.snapshot();
      const candidates = inRangeOf(after, tower(after));
      const healthiest = candidates.reduce((best, id) => (vectoid(after, id).hp > vectoid(after, best).hp ? id : best));
      const picked = targetOf(run);
      if (picked === null) throw new Error(`no target on cycle ${String(c)}`);
      out.push({ picked, healthiest });
      stepTicks(run, CYCLE_TICKS - 1);
    }
    return out;
  }

  it("the Green Laser 1 on (3,0) holds Lane 1's leader 15 from tick 30, so 15 is never the healthiest in the Purple Power's Range", () => {
    const run = spreadRun(false);
    stepTicks(run, FIRST_CHARGE_TICK + 1);
    expect(targetOf(run, 2)).toBe(15);
    expect(vectoid(run.snapshot(), 15).hp).toBeLessThan(STURDY_HP);
    stepTicks(run, 3 * CYCLE_TICKS);
    expect(targetOf(run, 2)).toBe(15);
  });

  it("lock off re-picks by Hard at the start of each cycle: 1, then 2, then 3, then 4, each the healthiest in Range at that tick", () => {
    const run = spreadRun(false);
    const seen = picks(run, 4);
    expect(seen.map((p) => p.picked)).toEqual([1, 2, 3, 4]);
    for (const p of seen) expect(p.picked).toBe(p.healthiest);
    // Each cycle's hit went to its own pick: 1..4 are each down one hit, 15 only to the laser.
    const s = run.snapshot();
    for (const id of [1, 2, 3, 4]) expect(vectoid(s, id).hp).toBe(STURDY_HP - 1325);
    expect(vectoid(s, 5).hp).toBe(STURDY_HP);
  });

  it("lock off never re-picks mid-charge: a healthier Vectoid entering Range waits for the next cycle start", () => {
    const run = spreadRun(false);
    stepTicks(run, FIRST_CHARGE_TICK + 1);
    expect(targetOf(run)).toBe(1);
    // Vectoid 2 comes on field on tick 90, untouched, while 1 is still being charged at.
    stepTicks(run, 60);
    expect(inRangeOf(run.snapshot(), tower(run.snapshot()))).toContain(2);
    expect(vectoid(run.snapshot(), 2).hp).toBe(STURDY_HP);
    expect(targetOf(run)).toBe(1);
    stepTicks(run, CHARGE_TICKS - 61);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - 1325);
    expect(targetOf(run)).toBe(1);
  });

  it("lock on (the default) holds 1 across cycles while healthier Vectoids enter Range, and setTargetLock does not clear the target", () => {
    const run = spreadRun(true);
    const seen = picks(run, 3);
    expect(seen.map((p) => p.picked)).toEqual([1, 1, 1]);
    expect(seen[1]?.healthiest).not.toBe(1);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - 3 * 1325);
    expect(vectoid(run.snapshot(), 2).hp).toBe(STURDY_HP);
    // verification 1.2: toggling the lock is free and keeps the current target.
    must(run, { type: "setTargetLock", towerId: 1, lock: false });
    expect(targetOf(run)).toBe(1);
    must(run, { type: "setTargetLock", towerId: 1, lock: true });
    expect(targetOf(run)).toBe(1);
  });

  it("a held target leaving Range mid-charge aborts that charge without a hit, and a new cycle starts the next tick", () => {
    const run = purpleRun("purplePower1");
    stepTicks(run, FIRST_CHARGE_TICK + 3 * CYCLE_TICKS);
    // Cycle 4 has just started on 1 (three hits so far); 1 leaves Range on tick 409, mid-charge.
    const start = run.snapshot();
    expect(start.tick).toBe(FIRST_CHARGE_TICK + 3 * CYCLE_TICKS);
    run.step();
    expect(targetOf(run)).toBe(1);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - 3 * 1325);
    stepUntil(run, (s) => tower(s).targetId !== 1, CHARGE_TICKS);
    const left = run.snapshot();
    expect(left.tick).toBeLessThan(FIRST_CHARGE_TICK + 3 * CYCLE_TICKS + CHARGE_TICKS);
    expect(distanceFrom(tower(left), vectoid(left, 1))).toBeGreaterThan(PURPLE_RANGE);
    expect(targetOf(run)).toBeNull();
    expect(left.beams).toEqual([]);
    run.step();
    const next = targetOf(run);
    expect(next).not.toBeNull();
    expect(next).not.toBe(1);
    expect(run.snapshot().beams).toEqual([{ towerId: 1, targetIds: [next ?? NaN], charge: chargeAt(0) }]);
    // 1 walks on with only its three hits.
    stepTicks(run, CHARGE_TICKS);
    expect(vectoid(run.snapshot(), 1).hp).toBe(STURDY_HP - 3 * 1325);
  });
});
