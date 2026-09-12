/**
 * M1-08: the colour rule, Hard Grey, the Bonus Cell, and Bonus Points.
 * Numbers: towers research 2.1 (multipliers), 2.2 (blue-bug variant), 1.1
 * (Green Laser 1 22 dmg x 40 hits/s, Red Refractor 110 dmg), 1.3 (Refractor
 * splash falloff); waves-and-economy research 1.1 (Bonus Wave rule, type
 * table) and 1.2 (Wave hit points); v1.2 verification 4 (per-type data).
 *
 * Method for putting one chosen Wave in front of a Tower: under a test-only
 * Ruleset with the Send gate lifted, Send Waves 1..N-1 at tick 0 and walk
 * them 15 s (24 Cells) down the Lanes, out of reach of any Tower by the
 * Entry; then Send Wave N and place the Tower on the same tick. The Tower's
 * `targetId` in the Snapshot names the primary, and lasers hold their
 * target by construction, so its hit-point drop is exact per tick.
 */
import { describe, expect, it } from "vitest";
import { classic, createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Ruleset, Run, Snapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Nothing ends the Run and every Wave can be Sent at once (M1-05 tests the gate itself). */
const generous = overrideRuleset(original, { lives: 100_000, maxAliveToSend: 100_000, suffix: "colour" });

/** Every Wave at 1 hp (the Bonus Cell at 4), so a single hit kills. */
const oneHp = overrideRuleset(original, { startHp: 1, lives: 100_000, maxAliveToSend: 100_000, suffix: "bonus-kill" });

/** A Cell by the Entry within Range of both Lanes' first Cells. */
const BY_THE_ENTRY = { col: 0, row: 0 } as const;

/** Wave 5 on Switchback (Original, Easy): waves research 1.2. */
const WAVE_5_HP = 1133;
const WAVE_5_BOUNTY = 9;
/** Green Laser 1: 22 damage x 40 hits/s (towers research 1.1). */
const GREEN_LASER_1_DPS = 22 * 40;
/** Red Refractor: 110 damage per shot (towers research 1.1). */
const REFRACTOR_DAMAGE = 110;

/** Send Waves 1..wave-1 at tick 0 and walk them 15 s down the Lanes. */
function runWithEarlierWavesGone(ruleset: Ruleset, wave: number): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  for (let w = 1; w < wave; w += 1) must(run, { type: "sendWave" });
  stepTicks(run, 15 * TICKS_PER_SECOND);
  return run;
}

function hasTarget(s: Snapshot): boolean {
  const id = s.towers[0]?.targetId;
  return id !== undefined && id !== null;
}

/** The first Tower's current target. */
function targetOf(run: Run): VectoidSnapshot {
  const s = run.snapshot();
  const id = s.towers[0]?.targetId;
  const v = s.vectoids.find((c) => c.id === id);
  if (v === undefined) throw new Error("the Tower has no target");
  return v;
}

describe("Green Laser 1 damage per second by the target's colour (towers research 2.1)", () => {
  it("is placed on a buildable Cell by the Entry", () => {
    expect(switchback.isBuildable(BY_THE_ENTRY)).toBe(true);
  });

  const cases = [
    // Wave 4 is Green Flyer: the Tree's own colour, 150%.
    { wave: 4, type: "greenFlyer", multiplier: 1.5, dps: 1320 },
    // Wave 2 is Red Shredder: the opposite colour, 50%.
    { wave: 2, type: "redShredder", multiplier: 0.5, dps: 440 },
    // Wave 1 is Blue Spinner: no affinity with Green, 100%.
    { wave: 1, type: "blueSpinner", multiplier: 1, dps: 880 },
    // Wave 5 is Hard Grey: 75% from every Tower (waves research 1.1).
    { wave: 5, type: "hardGrey", multiplier: 0.75, dps: 660 },
  ] as const;

  it.each(cases)("deals $dps dps ($multiplier x 880) to Wave $wave's $type", ({ wave, type, multiplier, dps }) => {
    const run = runWithEarlierWavesGone(generous, wave);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: BY_THE_ENTRY });
    stepUntil(run, hasTarget, 600);
    const first = targetOf(run);
    expect(first.wave).toBe(wave);
    expect(first.type).toBe(type);
    // One tick of beam: 22 x 40 / 120 per tick, times the multiplier.
    expect(first.maxHp - first.hp).toBeCloseTo((GREEN_LASER_1_DPS / TICKS_PER_SECOND) * multiplier, 9);
    // 29 more ticks on the same held target: 30 ticks is a quarter second.
    stepTicks(run, 29);
    const later = targetOf(run);
    expect(later.id).toBe(first.id);
    const dealtInAQuarterSecond = first.maxHp - later.hp;
    expect(dealtInAQuarterSecond * 4).toBeCloseTo(dps, 9);
    expect(dealtInAQuarterSecond * 4).toBeCloseTo(GREEN_LASER_1_DPS * multiplier, 9);
  });
});

describe("Red Refractor damage against colour-neutral Vectoids (towers research 2.1)", () => {
  it("deals 75% to a Hard Grey (Wave 5): 110 becomes 82.5 on the primary, and splash victims take the primary's 75% too", () => {
    const run = runWithEarlierWavesGone(generous, 5);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "redRefractor", cell: BY_THE_ENTRY });
    stepUntil(run, hasTarget, 600);
    const primary = targetOf(run);
    expect(primary.wave).toBe(5);
    expect(primary.type).toBe("hardGrey");
    expect(primary.maxHp).toBe(WAVE_5_HP);
    expect(primary.maxHp - primary.hp).toBeCloseTo(REFRACTOR_DAMAGE * 0.75, 9);
    // The other Lane's leader walks 0.8 Cells beside the primary, inside the
    // 2-Cell splash: linear falloff to 50% at the edge gives 80% of the
    // primary's 82.5 (towers research 1.3).
    const beside = run.snapshot().vectoids.find((v) => v.wave === 5 && v.lane !== primary.lane && v.hp < v.maxHp);
    expect(beside?.type).toBe("hardGrey");
    expect(beside === undefined ? NaN : beside.maxHp - beside.hp).toBeCloseTo(REFRACTOR_DAMAGE * 0.75 * 0.8, 9);
  });

  it("deals 100% to a Yellow Sprinter (Wave 6): 110 on the primary", () => {
    const run = runWithEarlierWavesGone(generous, 6);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "redRefractor", cell: BY_THE_ENTRY });
    stepUntil(run, hasTarget, 600);
    const primary = targetOf(run);
    expect(primary.wave).toBe(6);
    expect(primary.type).toBe("yellowSprinter");
    expect(primary.maxHp - primary.hp).toBeCloseTo(REFRACTOR_DAMAGE, 9);
  });
});

describe("the Bonus Wave (waves research 1.1)", () => {
  it("previews Wave 5 as Hard Grey with a Bonus Cell, then spawns 27 Hard Grey at 1,133 hp and one Bonus Cell at 4,532 hp as Lane 1's fourteenth", () => {
    const run = createRun({ ruleset: generous, map: switchback, seed: 1 });
    for (let wave = 1; wave <= 4; wave += 1) must(run, { type: "sendWave" });
    run.step();
    expect(run.snapshot().wave.next).toEqual({
      wave: 5,
      entry: "hardGrey",
      displayName: "Hard Grey",
      hp: WAVE_5_HP,
      bounty: WAVE_5_BOUNTY,
      bonus: true,
    });

    must(run, { type: "sendWave" });
    const spawned = eventsOfType(run.step(), "spawned").filter((e) => e.wave === 5);
    expect(spawned).toHaveLength(28);
    // Four Waves of 28 came first, so Wave 5 is ids 113..140.
    expect(spawned.map((e) => e.vectoidId)).toEqual(Array.from({ length: 28 }, (_, i) => 113 + i));
    expect(spawned.slice(0, 27).every((e) => e.vectoidType === "hardGrey")).toBe(true);
    expect(spawned[27]).toEqual({ type: "spawned", tick: 1, vectoidId: 140, vectoidType: "bonusCell", wave: 5, lane: 1 });

    const wave5 = run.snapshot().vectoids.filter((v) => v.wave === 5);
    expect(wave5).toHaveLength(28);
    const lane1 = wave5.filter((v) => v.lane === 1);
    expect(lane1).toHaveLength(14);
    const cell = lane1[13];
    expect(cell).toMatchObject({
      id: 140,
      type: "bonusCell",
      lane: 1,
      hp: WAVE_5_HP * 4, // hpMultiplier 4: 4,532
      maxHp: WAVE_5_HP * 4,
      bounty: WAVE_5_BOUNTY,
    });
    expect(cell?.maxHp).toBe(4532);
    const greys = wave5.filter((v) => v.id !== 140);
    expect(greys).toHaveLength(27);
    for (const v of greys) {
      expect(v.type).toBe("hardGrey");
      expect(v.hp).toBe(WAVE_5_HP);
      expect(v.maxHp).toBe(WAVE_5_HP);
    }
  });

  it("killing the Bonus Cell earns one Bonus Point and a bonusPointEarned Event; killing Hard Greys earns none", () => {
    const run = runWithEarlierWavesGone(oneHp, 5);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: BY_THE_ENTRY });
    // Hard picks the highest current hit points: the 4-hp Bonus Cell over
    // the 1-hp Hard Greys as soon as it is in Range.
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    expect(run.snapshot().economy.bonusPoints).toBe(0);

    const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "bonusPointEarned"), 3000);
    const earned = eventsOfType(events, "bonusPointEarned");
    expect(earned).toHaveLength(1);
    expect(earned[0]).toMatchObject({ vectoidId: 140 });
    const kills = eventsOfType(events, "killed");
    const cellKill = kills.find((k) => k.vectoidId === 140);
    expect(cellKill).toMatchObject({ towerId: 1, bounty: WAVE_5_BOUNTY });
    expect(cellKill?.tick).toBe(earned[0]?.tick);
    // Hard Greys died before the Bonus Cell (it walks last) and earned nothing.
    expect(kills.length).toBeGreaterThan(1);
    expect(run.snapshot().economy.bonusPoints).toBe(1);
    expect(run.snapshot().vectoids.some((v) => v.id === 140)).toBe(false);
  });

  it("letting the Bonus Cell Leak earns nothing: it restarts at the Entry, Bonus Points stay 0", () => {
    const run = createRun({ ruleset: generous, map: switchback, seed: 1 });
    for (let wave = 1; wave <= 5; wave += 1) must(run, { type: "sendWave" });
    // Lane 1 is 100.8 Cells and the Bonus Cell starts 10.4 Cells behind its
    // Entry, so at 1.6 Cells/s it Leaks at 69.5 s (maps research: Switchback).
    const events = stepTicks(run, 70 * TICKS_PER_SECOND);
    const leaks = eventsOfType(events, "leaked").filter((l) => l.vectoidId === 140);
    expect(leaks).toHaveLength(1);
    expect(leaks[0]?.tick).toBeGreaterThanOrEqual(69.5 * TICKS_PER_SECOND - 2);
    expect(leaks[0]?.tick).toBeLessThanOrEqual(69.5 * TICKS_PER_SECOND);
    expect(eventsOfType(events, "bonusPointEarned")).toEqual([]);
    const s = run.snapshot();
    expect(s.economy.bonusPoints).toBe(0);
    const cell = s.vectoids.find((v) => v.id === 140);
    expect(cell?.type).toBe("bonusCell");
    expect(cell?.hp).toBe(WAVE_5_HP * 4);
    expect(cell?.distance).toBeLessThan(1);
  });
});

describe("what the seam exposes", () => {
  it("Snapshot exposes Bonus Points, starting at 0", () => {
    const s = createRun({ ruleset: original, map: switchback, seed: 1 }).snapshot();
    expect(s.economy.bonusPoints).toBe(0);
  });

  it("Ruleset exposes the blue-bug variant: Original keeps it (v1.2 as shipped), Classic fixes it (ADR 0001 item 1, towers research 2.2)", () => {
    expect(original.variants.blueTowersSkipPenalties).toBe(true);
    expect(classic.variants.blueTowersSkipPenalties).toBe(false);
  });

  it("Ruleset carries the colour rule and the Bonus Wave numbers", () => {
    expect(original.colourRule).toEqual({ sameColour: 1.5, oppositeColour: 0.5 }); // towers research 2.1
    expect(original.vectoids.hardGrey.damageTaken).toBe(0.75); // waves research 1.1
    expect(original.vectoids.bonusCell).toMatchObject({ damageTaken: 0.75, hpMultiplier: 4, awardsBonusPoint: true });
    expect(original.bonusWaveEvery).toBe(5);
  });
});
