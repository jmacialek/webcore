/**
 * M1-11: Vectoid speed, slow recovery, and Blue Rays 1 and 2.
 * Numbers: towers research 1.1 (Blue Rays 1 500 dmg $300 Range 70 px; Blue
 * Rays 2 4000 dmg $500 Range 80 px, both after the v1.2 Corrections), 1.3
 * (Blue Rays 1: 4 slots per 40 frames, unslowed first, speed = maxSpeed / 6;
 * Blue Rays 2: fastest per 120 frames, speed = 0; recovery +0.01 px/frame
 * per frame = 0.64 Cells/s^2), 2.1 and 2.2 (colour rule and the blue bug),
 * 3.1 (FASTEST: strict `speed > best`, ties to the earliest spawned);
 * v1.2 verification 1.4 (Blue Rays 1's two passes; Blue Rays 2 picks a
 * Yellow Sprinter when one is present and unslowed).
 *
 * Scenario methods reused from colour-rule.test.ts and targeting.test.ts:
 * under a test-only Ruleset with the Send gate lifted, Send Waves 1..N-1 at
 * tick 0 and walk them 15 s clear of the Entry, then Send Wave N and place
 * the Tower on the same tick. Both Lanes pass a Cell by the Entry; a Cell on
 * row 0 east of column 4 sees only Lane 1's run along y = 2.6 (Lane 0 runs
 * along y = 3.4, 2.9 Cells away, outside Blue Rays 1's 2.8), which is how a
 * test puts exactly five Vectoids in Range.
 */
import { describe, expect, it } from "vitest";
import { classic, createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Cell, Ruleset, Run, Snapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

const BR1_DAMAGE = 500; // towers research 1.1 and Corrections
const BR1_PERIOD_TICKS = TICKS_PER_SECOND; // towers research 1.3: once per 40 frames = 1 s
const BR1_SLOTS = 4; // towers research 1.3
const BR1_RANGE = 2.8; // towers research 1.1: 70 px
const SLOW_FACTOR = 1 / 6; // towers research 1.3: speed = maxSpeed / 6
const BR2_DAMAGE = 4000; // towers research 1.1 and Corrections
const BR2_PERIOD_TICKS = 3 * TICKS_PER_SECOND; // towers research 1.3: once per 120 frames = 3 s
const BASE_SPEED = 1.6; // waves research 1.1: 1 px/frame
const SPRINTER_SPEED = 3.2; // waves research 1.1: Yellow Sprinter speed 2
const RECOVERY = 0.64; // towers research 1.3: +0.01 px/frame per frame
const RECOVERY_PER_TICK = RECOVERY / TICKS_PER_SECOND;

/** Nothing dies, nothing ends the Run, every Wave can be Sent at once, and every Blue Tower is affordable. */
function sturdy(base: Ruleset, suffix: string, vectoidsPerLane?: number): Ruleset {
  return overrideRuleset(base, {
    startHp: 100_000,
    startBank: 100_000,
    lives: 100_000,
    maxAliveToSend: 100_000,
    ...(vectoidsPerLane === undefined ? {} : { vectoidsPerLane }),
    suffix,
  });
}

const rich = sturdy(original, "blue-rays");
/** Five Vectoids per Lane so a Tower that sees one Lane sees exactly five. */
const fivePerLane = sturdy(original, "five-per-lane", 5);

/** A Cell by the Entry within Range of both Lanes' first Cells. */
const BY_THE_ENTRY = { col: 0, row: 0 } as const;
/** A Cell on the top row that sees only Lane 1's run along y = 2.6. */
const OVER_LANE_1 = { col: 6, row: 0 } as const;

/** Send Waves 1..wave-1 at tick 0 and walk them 15 s down the Lanes. */
function runWithEarlierWavesGone(ruleset: Ruleset, wave: number): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  for (let w = 1; w < wave; w += 1) must(run, { type: "sendWave" });
  stepTicks(run, 15 * TICKS_PER_SECOND);
  return run;
}

function vectoid(s: Snapshot, id: number): VectoidSnapshot {
  const v = s.vectoids.find((x) => x.id === id);
  if (v === undefined) throw new Error(`no Vectoid ${String(id)} in the Snapshot`);
  return v;
}

function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

/** Ids of the on-field Vectoids within `range` of a Cell's centre, in spawn order (towers research 3.3). */
function inRangeOf(s: Snapshot, cell: Cell, range: number): number[] {
  const cx = cell.col + 0.5;
  const cy = cell.row + 0.5;
  return s.vectoids.filter((v) => onField(v) && (v.x - cx) ** 2 + (v.y - cy) ** 2 <= range * range).map((v) => v.id);
}

/** Step until Tower `towerId` draws a beam; returns that beam's target ids. */
function stepUntilShot(run: Run, towerId: number, maxTicks: number): number[] {
  stepUntil(run, (s) => s.beams.some((b) => b.towerId === towerId), maxTicks);
  const beam = run.snapshot().beams.find((b) => b.towerId === towerId);
  if (beam === undefined) throw new Error("no beam");
  return [...beam.targetIds];
}

describe("Vectoid speed recovery (towers research 1.3)", () => {
  it("is placed on buildable Cells", () => {
    expect(switchback.isBuildable(BY_THE_ENTRY)).toBe(true);
    expect(switchback.isBuildable(OVER_LANE_1)).toBe(true);
  });

  it("a Blue Spinner slowed to 1.6 / 6 gains 0.64 / 120 Cells/s every tick and is back at exactly 1.6 after 250 ticks (2.08 s)", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays1", cell: BY_THE_ENTRY });
    const hit = stepUntilShot(run, 1, 600);
    expect(hit).toContain(1);
    expect(vectoid(run.snapshot(), 1).speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR, 12);
    // Sell the Tower so nothing slows the Vectoid again while it recovers.
    must(run, { type: "sell", towerId: 1 });

    let previous = vectoid(run.snapshot(), 1).speed;
    for (let t = 1; t <= 249; t += 1) {
      run.step();
      const now = vectoid(run.snapshot(), 1).speed;
      expect(now - previous).toBeCloseTo(RECOVERY_PER_TICK, 12);
      expect(now).toBeLessThan(BASE_SPEED);
      previous = now;
    }
    // (1.6 - 1.6 / 6) / (0.64 / 120) = 250 ticks exactly; the cap makes it exact, not close.
    run.step();
    const recovered = vectoid(run.snapshot(), 1);
    expect(recovered.speed).toBe(BASE_SPEED);
    expect(recovered.speed).toBe(recovered.maxSpeed);
    // And it stays there.
    run.step();
    expect(vectoid(run.snapshot(), 1).speed).toBe(BASE_SPEED);
  });

  it("a Yellow Sprinter (Wave 6) stopped by Blue Rays 2 recovers toward 3.2 and reaches it after 600 ticks (5 s)", () => {
    const run = runWithEarlierWavesGone(rich, 6);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays2", cell: BY_THE_ENTRY });
    const [id] = stepUntilShot(run, 1, 600);
    if (id === undefined) throw new Error("Blue Rays 2 hit nothing");
    const stopped = vectoid(run.snapshot(), id);
    expect(stopped.type).toBe("yellowSprinter");
    expect(stopped.maxSpeed).toBe(SPRINTER_SPEED);
    expect(stopped.speed).toBe(0);
    must(run, { type: "sell", towerId: 1 });

    run.step();
    expect(vectoid(run.snapshot(), id).speed).toBeCloseTo(RECOVERY_PER_TICK, 12);
    stepTicks(run, 119);
    // 1 s: 0.64 Cells/s, still well below a Sprinter's 3.2.
    expect(vectoid(run.snapshot(), id).speed).toBeCloseTo(RECOVERY, 9);
    // 5 s: 600 increments sum to 3.2 within floating-point rounding
    // (3.19999999999998); the cap then makes the next tick exactly 3.2.
    stepTicks(run, 480);
    expect(vectoid(run.snapshot(), id).speed).toBeCloseTo(SPRINTER_SPEED, 9);
    expect(vectoid(run.snapshot(), id).speed).toBeLessThanOrEqual(SPRINTER_SPEED);
    run.step();
    expect(vectoid(run.snapshot(), id).speed).toBe(SPRINTER_SPEED);
  });
});

describe("Blue Rays 1: up to four Vectoids per second, unslowed first (towers research 1.3; verification 1.4)", () => {
  it("with exactly five Vectoids in Range slows the four unslowed ones and leaves the fifth; a second later the fifth goes first, then three recovering ones", () => {
    // Five per Lane: Lane 0 is ids 1..5, Lane 1 is ids 6..10. The Tower over
    // Lane 1's run along y = 2.6 (2.1 Cells below its centre) reaches 1.85
    // Cells either side, a 3.7-Cell window that holds five Vectoids 0.8 apart.
    const run = createRun({ ruleset: fivePerLane, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    expect(run.step().filter((e) => e.type === "spawned")).toHaveLength(10);
    stepUntil(run, (s) => inRangeOf(s, OVER_LANE_1, BR1_RANGE).length === 5, 2000);
    expect(inRangeOf(run.snapshot(), OVER_LANE_1, BR1_RANGE)).toEqual([6, 7, 8, 9, 10]);
    must(run, { type: "placeTower", kind: "blueRays1", cell: OVER_LANE_1 });
    const placedAt = run.tick;

    // First shot: the same tick, four slots, all five unslowed, spawn order.
    const events = run.step();
    expect(eventsOfType(events, "towerPlaced")).toHaveLength(1);
    let s = run.snapshot();
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [6, 7, 8, 9], charge: 1 }]);
    expect(s.towers[0]?.targetId).toBe(6);
    for (const id of [6, 7, 8, 9]) {
      const v = vectoid(s, id);
      expect(v.speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR, 12);
      // Blue on Blue Spinner: 150% of 500 (towers research 2.1).
      expect(v.maxHp - v.hp).toBeCloseTo(BR1_DAMAGE * 1.5, 9);
    }
    const fifth = vectoid(s, 10);
    expect(fifth.speed).toBe(BASE_SPEED);
    expect(fifth.hp).toBe(fifth.maxHp);

    // Nothing for the rest of the second (1 s = 120 ticks between shots).
    for (let t = 1; t < BR1_PERIOD_TICKS; t += 1) {
      run.step();
      expect(run.snapshot().beams).toEqual([]);
    }
    expect(run.tick).toBe(placedAt + BR1_PERIOD_TICKS);
    // The four are recovering but below max, so only the fifth is "unslowed".
    s = run.snapshot();
    for (const id of [7, 8, 9]) {
      const speed = vectoid(s, id).speed;
      expect(speed).toBeGreaterThan(BASE_SPEED * SLOW_FACTOR);
      expect(speed).toBeLessThan(BASE_SPEED);
    }
    // The leader (6) has walked out of the window by now; 7, 8, 9 and 10 remain.
    expect(inRangeOf(s, OVER_LANE_1, BR1_RANGE)).toEqual([7, 8, 9, 10]);

    // Second shot: the fifth first, then the recovering ones in spawn order.
    run.step();
    s = run.snapshot();
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [10, 7, 8, 9], charge: 1 }]);
    expect(s.towers[0]?.targetId).toBe(10);
    expect(vectoid(s, 10).speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR, 12);
    // A recovering Vectoid is set back to 1.6 / 6: min(current, maxSpeed / 6).
    for (const id of [7, 8, 9]) {
      expect(vectoid(s, id).speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR, 12);
      expect(vectoid(s, id).maxHp - vectoid(s, id).hp).toBeCloseTo(2 * BR1_DAMAGE * 1.5, 9);
    }
    // The leader, out of Range, kept recovering untouched.
    expect(vectoid(s, 6).speed).toBeGreaterThan(BASE_SPEED * SLOW_FACTOR);
  });

  it("on a full Wave by the Entry: the first shot takes the two leaders, the next fills its slots with the four unslowed newcomers and leaves the recovering leaders", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays1", cell: BY_THE_ENTRY });
    // The leaders (1 and 15) come on field 0.4 Cells in, at tick 30 (targeting.test.ts geometry).
    expect(stepUntilShot(run, 1, 600)).toEqual([1, 15]);
    const firstShotTick = run.tick;
    expect(firstShotTick).toBe(31);
    stepTicks(run, BR1_PERIOD_TICKS - 1);
    expect(run.snapshot().beams).toEqual([]);
    run.step();
    const s = run.snapshot();
    // In Range now: 1, 2, 3 and 15, 16, 17; the leaders are still recovering.
    expect(inRangeOf(s, BY_THE_ENTRY, BR1_RANGE)).toEqual([1, 2, 3, 15, 16, 17]);
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [2, 3, 16, 17], charge: 1 }]);
    expect(s.towers[0]?.targetId).toBe(2);
    for (const id of [1, 15]) {
      expect(vectoid(s, id).speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR + BR1_PERIOD_TICKS * RECOVERY_PER_TICK, 9);
      expect(vectoid(s, id).maxHp - vectoid(s, id).hp).toBeCloseTo(BR1_DAMAGE * 1.5, 9);
    }
    expect(s.beams[0]?.targetIds).toHaveLength(BR1_SLOTS);
  });
});

describe("Blue Rays 2: the single fastest Vectoid every three seconds, stopped dead (towers research 1.3, 3.1; verification 1.4)", () => {
  it("with Blue Spinners (Wave 1) and Yellow Sprinters (Wave 6) both in Range picks the earliest-spawned Sprinter, deals 4000, and sets its speed to 0", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    // Both Waves at the Entry together; the Sprinters overtake at 3.2 Cells/s.
    for (let w = 1; w <= 6; w += 1) must(run, { type: "sendWave" });
    stepTicks(run, 60);
    must(run, { type: "placeTower", kind: "blueRays2", cell: BY_THE_ENTRY });
    run.step();
    const s = run.snapshot();
    const inRange = inRangeOf(s, BY_THE_ENTRY, 3.2).map((id) => vectoid(s, id));
    expect(inRange.some((v) => v.type === "blueSpinner")).toBe(true);
    expect(inRange.some((v) => v.type === "yellowSprinter")).toBe(true);
    // Wave 6's leader on Lane 0 is Vectoid 141 (five Waves of 28 came first).
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [141], charge: 1 }]);
    expect(s.towers[0]?.targetId).toBe(141);
    const stopped = vectoid(s, 141);
    expect(stopped.type).toBe("yellowSprinter");
    expect(stopped.wave).toBe(6);
    expect(stopped.speed).toBe(0);
    // Colour-neutral: 100% of 4000 (towers research 2.1).
    expect(stopped.maxHp - stopped.hp).toBeCloseTo(BR2_DAMAGE, 9);
    // Everyone else keeps their speed.
    for (const v of inRange) if (v.id !== 141) expect(v.speed).toBe(v.maxSpeed);
  });

  it("with equal speeds picks the earliest spawned (Vectoid 1), then nothing for three seconds, then the fastest again", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays2", cell: BY_THE_ENTRY });
    expect(stepUntilShot(run, 1, 600)).toEqual([1]);
    const firstShotTick = run.tick;
    expect(vectoid(run.snapshot(), 1).speed).toBe(0);
    expect(vectoid(run.snapshot(), 15).speed).toBe(BASE_SPEED);
    for (let t = 1; t < BR2_PERIOD_TICKS; t += 1) {
      run.step();
      expect(run.snapshot().beams).toEqual([]);
    }
    run.step();
    expect(run.tick).toBe(firstShotTick + BR2_PERIOD_TICKS);
    const s = run.snapshot();
    // Vectoid 1 is at 3 x 0.64 = 1.92 capped to 1.6 by now, tied with the rest, so it wins again as the earliest spawned.
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [1], charge: 1 }]);
    expect(vectoid(s, 1).speed).toBe(0);
  });
});

describe("the colour rule through Blue Rays 1: Original skips the penalties, Classic applies them (towers research 2.1, 2.2; ADR 0001 item 1)", () => {
  const cases = [
    // Wave 8 is Big Purple Box: the opposite colour, 50% under Classic.
    { rulesetId: "original", wave: 8, type: "bigPurpleBox", damage: 500 },
    { rulesetId: "classic", wave: 8, type: "bigPurpleBox", damage: 250 },
    // Wave 5 is Hard Grey: 75% from every Tower under Classic.
    { rulesetId: "original", wave: 5, type: "hardGrey", damage: 500 },
    { rulesetId: "classic", wave: 5, type: "hardGrey", damage: 375 },
    // Wave 1 is Blue Spinner: the Tree's own colour, 150% under both.
    { rulesetId: "original", wave: 1, type: "blueSpinner", damage: 750 },
    { rulesetId: "classic", wave: 1, type: "blueSpinner", damage: 750 },
  ] as const;

  it.each(cases)("$rulesetId: deals $damage of 500 to each of Wave $wave's $type", ({ rulesetId, wave, type, damage }) => {
    const base = rulesetId === "original" ? original : classic;
    expect(base.variants.blueTowersSkipPenalties).toBe(rulesetId === "original");
    const run = runWithEarlierWavesGone(sturdy(base, `colour-${rulesetId}`), wave);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "blueRays1", cell: BY_THE_ENTRY });
    const hit = stepUntilShot(run, 1, 600);
    // Both Lanes' leaders come on field together.
    expect(hit).toHaveLength(2);
    const s = run.snapshot();
    for (const id of hit) {
      const v = vectoid(s, id);
      expect(v.wave).toBe(wave);
      expect(v.type).toBe(type);
      expect(v.maxHp - v.hp).toBeCloseTo(damage, 9);
      expect(v.speed).toBeCloseTo(BASE_SPEED * SLOW_FACTOR, 12);
    }
  });
});

describe("what the seam exposes", () => {
  it("Blue Rays 1 and 2 show Fastest and reject mode Commands with modeNotSelectable (verification 1.4)", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "blueRays1", cell: BY_THE_ENTRY });
    must(run, { type: "placeTower", kind: "blueRays2", cell: { col: 3, row: 0 } });
    for (const t of run.snapshot().towers) expect(t).toMatchObject({ mode: "fastest", selectableModes: false, lockable: false });
    expect(run.apply(at(run, { type: "setTargetingMode", towerId: 1, mode: "close" }))).toEqual({ ok: false, reason: "modeNotSelectable" });
    expect(run.apply(at(run, { type: "setTargetingMode", towerId: 2, mode: "hard" }))).toEqual({ ok: false, reason: "modeNotSelectable" });
  });

  it("Ruleset carries the Blue Rays and recovery numbers", () => {
    const br1 = original.towers.find((t) => t.kind === "blueRays1");
    const br2 = original.towers.find((t) => t.kind === "blueRays2");
    expect(br1).toMatchObject({ tree: "blue", cost: 300, damage: BR1_DAMAGE, range: BR1_RANGE, cooldown: 1 });
    expect(br1?.mechanics).toEqual({ type: "multiSlow", slots: BR1_SLOTS, factor: SLOW_FACTOR });
    expect(br2).toMatchObject({ tree: "blue", cost: 500, damage: BR2_DAMAGE, range: 3.2, cooldown: 3 });
    expect(br2?.mechanics).toEqual({ type: "stun" });
    expect(original.movement.baseSpeed).toBeCloseTo(BASE_SPEED, 12);
    expect(original.movement.speedRecovery).toBeCloseTo(RECOVERY, 12);
    expect(original.vectoids.yellowSprinter.speedMultiplier).toBe(2);
  });
});
