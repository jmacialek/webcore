/**
 * M1-14: Damage Booster and Range Booster.
 * Numbers: towers research 1.4 (each Booster costs one Bonus Point and adds
 * 25 points to that stat of every Tower whose centre is < 100 px = 4 Cells
 * away, additively across Boosters, recomputed whenever a Tower is placed
 * or removed); v1.2 verification 3 notes (`doBuffs()` applies to Towers
 * < 100 px from the Booster); towers research Addendum 2026-09-12 (a
 * Booster can never be sold or upgraded: placing one is permanent).
 *
 * Method for earning two Bonus Points quickly: a test-only Ruleset with one
 * Vectoid per Lane, so every Wave is two Vectoids and Lane 1's is the Bonus
 * Cell on Waves 5 and 10; every Wave at 1 hp (the Bonus Cell at 4); the Send
 * gate lifted. A Green Laser 1 by the Entry switched to Hard kills each Wave
 * as it arrives, and Waves 1..10 are Sent one after another, each stepped
 * until `waveCleared`: about 650 ticks in all. Most scenarios then sell that
 * laser so they start from an empty Grid with two Bonus Points.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { createRun, original, switchback } from "../src/index.js";
import type { BoosterKind, CommandType, RejectReason, Run, Snapshot, TowerSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** One Vectoid per Lane at 1 hp (the Bonus Cell at 4), every Wave Sendable at once, and a Bank that affords a few lasers. */
const twoCells = overrideRuleset(original, { startHp: 1, startBank: 1000, maxAliveToSend: 100_000, vectoidsPerLane: 1, suffix: "boosters" });

/** A Cell by the Entry within Range of both Lanes' first Cells. */
const BY_THE_ENTRY = { col: 0, row: 0 } as const;

/** Green Laser 1: 22 damage, Range 70 px = 2.8 Cells (towers research 1.1). */
const GL1_DAMAGE = 22;
const GL1_RANGE = 2.8;
/** Each Booster adds 25 percentage points (towers research 1.4). */
const BOOSTER_PERCENT = 25;
/** A Tower is buffed when its centre is strictly less than 100 px = 4 Cells from the Booster (v1.2 verification 3). */
const BOOSTER_RADIUS = 4;

/** Wave 5's Bonus Cell is Lane 1's Vectoid, id 10 after four Waves of two; Wave 10's is id 20. */
const WAVE_5_CELL = 10;
const WAVE_10_CELL = 20;

function tower(s: Snapshot, id: number): TowerSnapshot {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no Tower ${String(id)} in the Snapshot`);
  return t;
}

function placeLaser(run: Run, cell: { col: number; row: number }): void {
  must(run, { type: "placeTower", kind: "greenLaser1", cell });
}

function placeBooster(run: Run, kind: BoosterKind, cell: { col: number; row: number }): void {
  must(run, { type: "placeBooster", kind, cell });
}

function rejection(run: Run, command: Parameters<typeof at>[1]): RejectReason | "ok" {
  const result = run.apply(at(run, command));
  return result.ok ? "ok" : result.reason;
}

/** Kill the Bonus Cells of Waves 5 and 10: a Run with two Bonus Points, an empty field, and Tower 1 (Green Laser 1, Hard) by the Entry. */
function runWithTwoBonusPoints(): Run {
  const run = createRun({ ruleset: twoCells, map: switchback, seed: 1 });
  placeLaser(run, BY_THE_ENTRY);
  // Hard picks the 4-hp Bonus Cell over the 1-hp Vectoid beside it.
  must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
  const earned: number[] = [];
  for (let wave = 1; wave <= 10; wave += 1) {
    must(run, { type: "sendWave" });
    const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "waveCleared"), 600);
    earned.push(...eventsOfType(events, "bonusPointEarned").map((e) => e.vectoidId));
  }
  expect(earned).toEqual([WAVE_5_CELL, WAVE_10_CELL]);
  const s = run.snapshot();
  expect(s.economy.bonusPoints).toBe(2);
  expect(s.vectoids).toEqual([]);
  expect(s.wave.current).toBe(10);
  return run;
}

/** The same Run with the earning laser sold, so no Tower and no Booster is on the Grid. */
function emptyGridWithTwoBonusPoints(): Run {
  const run = runWithTwoBonusPoints();
  must(run, { type: "sell", towerId: 1 });
  run.step();
  expect(run.snapshot().towers).toEqual([]);
  expect(run.snapshot().boosters).toEqual([]);
  return run;
}

describe("earning the Bonus Points for these scenarios", () => {
  it("Waves 5 and 10 each carry one Bonus Cell under the one-Vectoid-per-Lane Ruleset, and killing both earns two Bonus Points by tick 700", () => {
    const run = runWithTwoBonusPoints();
    expect(run.tick).toBeLessThan(700);
    expect(run.snapshot().economy.lives).toBe(20); // no Leaks
  });
});

describe("placing a Booster (towers research 1.4)", () => {
  it("spends one Bonus Point, lists the Booster in the Snapshot, and emits boosterPlaced and bonusItemUsed on the next step", () => {
    const run = emptyGridWithTwoBonusPoints();
    const cell = { col: 3, row: 0 };
    expect(switchback.isBuildable(cell)).toBe(true);
    const tick = run.tick;
    placeBooster(run, "damageBooster", cell);
    const s = run.snapshot();
    expect(s.economy.bonusPoints).toBe(1);
    expect(s.boosters).toEqual([{ id: 1, kind: "damageBooster", cell: { col: 3, row: 0 } }]);
    const events = run.step();
    expect(eventsOfType(events, "boosterPlaced")).toEqual([{ type: "boosterPlaced", tick, boosterId: 1, kind: "damageBooster", cell: { col: 3, row: 0 } }]);
    expect(eventsOfType(events, "bonusItemUsed")).toEqual([{ type: "bonusItemUsed", tick, item: "damageBooster" }]);
    expect(run.log().at(-1)).toEqual({ command: { type: "placeBooster", tick, kind: "damageBooster", cell: { col: 3, row: 0 } }, result: { ok: true } });
  });

  it("a Range Booster is placed the same way and reports item rangeBooster", () => {
    const run = emptyGridWithTwoBonusPoints();
    const tick = run.tick;
    placeBooster(run, "rangeBooster", { col: 4, row: 0 });
    expect(run.snapshot().boosters).toEqual([{ id: 1, kind: "rangeBooster", cell: { col: 4, row: 0 } }]);
    const events = run.step();
    expect(eventsOfType(events, "bonusItemUsed")).toEqual([{ type: "bonusItemUsed", tick, item: "rangeBooster" }]);
  });

  it("Booster ids count from 1 in their own space, apart from Tower ids", () => {
    const run = runWithTwoBonusPoints(); // Tower 1 is on the Grid
    placeBooster(run, "damageBooster", { col: 3, row: 0 });
    placeBooster(run, "rangeBooster", { col: 4, row: 0 });
    const s = run.snapshot();
    expect(s.towers.map((t) => t.id)).toEqual([1]);
    expect(s.boosters.map((b) => b.id)).toEqual([1, 2]);
    expect(s.economy.bonusPoints).toBe(0);
  });

  it("is rejected with noBonusPoints at 0 Bonus Points: on a fresh Run and once both are spent; nothing is placed", () => {
    const fresh = createRun({ ruleset: original, map: switchback, seed: 1 });
    expect(fresh.snapshot().economy.bonusPoints).toBe(0);
    expect(rejection(fresh, { type: "placeBooster", kind: "damageBooster", cell: { col: 3, row: 0 } })).toBe("noBonusPoints");
    expect(fresh.snapshot().boosters).toEqual([]);

    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", { col: 3, row: 0 });
    placeBooster(run, "damageBooster", { col: 4, row: 0 });
    expect(run.snapshot().economy.bonusPoints).toBe(0);
    expect(eventsOfType(run.step(), "boosterPlaced")).toHaveLength(2); // the two that succeeded
    expect(rejection(run, { type: "placeBooster", kind: "rangeBooster", cell: { col: 5, row: 0 } })).toBe("noBonusPoints");
    expect(run.snapshot().boosters).toHaveLength(2);
    expect(run.step()).toEqual([]); // a rejected Command emits nothing
  });

  const badCells = [
    { name: "a Cell past the right edge", cell: { col: 22, row: 0 }, reason: "cellOffGrid" },
    { name: "a Cell above the Grid", cell: { col: 0, row: -1 }, reason: "cellOffGrid" },
    { name: "a Corridor Cell on Lane 0", cell: { col: 1, row: 0 }, reason: "cellIsCorridor" },
    { name: "a Corridor Cell on Lane 1", cell: { col: 2, row: 2 }, reason: "cellIsCorridor" },
    { name: "the Cell of a Tower", cell: { col: 0, row: 0 }, reason: "cellOccupied" },
    { name: "the Cell of another Booster", cell: { col: 3, row: 0 }, reason: "cellOccupied" },
  ] as const;

  it.each(badCells)("is rejected on $name with $reason, like a Tower, and keeps the Bonus Point", ({ cell, reason }) => {
    const run = runWithTwoBonusPoints(); // Tower 1 on (0,0)
    placeBooster(run, "damageBooster", { col: 3, row: 0 }); // Booster 1
    expect(run.snapshot().economy.bonusPoints).toBe(1);
    expect(rejection(run, { type: "placeBooster", kind: "rangeBooster", cell })).toBe(reason);
    expect(rejection(run, { type: "placeTower", kind: "greenLaser1", cell })).toBe(reason);
    const s = run.snapshot();
    expect(s.economy.bonusPoints).toBe(1);
    expect(s.boosters).toHaveLength(1);
    expect(s.towers).toHaveLength(1);
  });
});

describe("Damage Booster (towers research 1.4; v1.2 verification 3)", () => {
  it("a Tower within four Cells of two Damage Boosters shows 150% of its base damage; exactly four Cells from one is outside (strict <); inside one only is 125%", () => {
    const run = emptyGridWithTwoBonusPoints();
    // Tower 2 on (5,0) placed before the Boosters; Towers 3 and 4 after them.
    placeLaser(run, { col: 5, row: 0 }); // Tower 2: 2 and 1 Cells from the Boosters
    placeBooster(run, "damageBooster", { col: 3, row: 0 }); // Booster 1
    placeBooster(run, "damageBooster", { col: 4, row: 0 }); // Booster 2
    placeLaser(run, { col: 8, row: 0 }); // Tower 3: 5 and exactly 4 Cells away
    placeLaser(run, { col: 7, row: 0 }); // Tower 4: exactly 4 and 3 Cells away
    const s = run.snapshot();
    expect(s.boosters.map((b) => b.kind)).toEqual(["damageBooster", "damageBooster"]);

    const inside = tower(s, 2);
    expect(inside).toMatchObject({ baseDamage: GL1_DAMAGE, damageBuff: 2 * BOOSTER_PERCENT, rangeBuff: 0 });
    expect(inside.damage).toBe(GL1_DAMAGE * 1.5);
    expect(inside.damage).toBe(33);
    expect(inside.range).toBe(inside.baseRange); // a Damage Booster leaves Range alone

    const outside = tower(s, 3);
    expect(Math.hypot(8.5 - 4.5, 0.5 - 0.5)).toBe(BOOSTER_RADIUS); // centre to centre, Booster 2
    expect(outside).toMatchObject({ baseDamage: GL1_DAMAGE, damage: GL1_DAMAGE, damageBuff: 0, rangeBuff: 0 });

    const halfway = tower(s, 4);
    expect(halfway).toMatchObject({ baseDamage: GL1_DAMAGE, damageBuff: BOOSTER_PERCENT });
    expect(halfway.damage).toBe(GL1_DAMAGE * 1.25);
    expect(halfway.damage).toBe(27.5);
  });

  it("a Booster just inside the radius counts: a Tower three Cells from a Booster is buffed, four is not", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", BY_THE_ENTRY); // Booster 1 on (0,0)
    placeLaser(run, { col: 3, row: 0 }); // Tower 2: distance 3
    placeLaser(run, { col: 4, row: 0 }); // Tower 3: distance 4
    const s = run.snapshot();
    expect(tower(s, 2).damageBuff).toBe(BOOSTER_PERCENT);
    expect(tower(s, 3).damageBuff).toBe(0);
  });
});

describe("Range Booster (towers research 1.4)", () => {
  const LASER_CELL = { col: 5, row: 0 } as const;
  const LASER_CENTRE = { x: 5.5, y: 0.5 } as const;

  it("raises Range by 25%: 2.8 Cells becomes 3.5 (rangeBuff 25) and damage is untouched", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeLaser(run, LASER_CELL); // Tower 2
    expect(tower(run.snapshot(), 2)).toMatchObject({ baseRange: GL1_RANGE, range: GL1_RANGE, rangeBuff: 0 });
    placeBooster(run, "rangeBooster", { col: 3, row: 0 }); // 2 Cells from the laser
    const t = tower(run.snapshot(), 2);
    expect(t.rangeBuff).toBe(BOOSTER_PERCENT);
    expect(t.baseRange).toBe(GL1_RANGE);
    expect(t.range).toBeCloseTo(GL1_RANGE * 1.25, 12);
    expect(t.range).toBeCloseTo(3.5, 12);
    expect(t).toMatchObject({ damage: GL1_DAMAGE, damageBuff: 0 });
  });

  it("a Vectoid 3.1 Cells away, out of Range before the Booster, is targeted on the step after it", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeLaser(run, LASER_CELL); // Tower 2
    // Lane 1 enters the field down column 2 (x = 2.4): 3.1 Cells from the
    // laser's centre horizontally, so its Vectoid is never within 2.8 there
    // but is within 3.5 for its first two Cells. Lane 0 (x = 1.6) stays 3.9 away.
    must(run, { type: "sendWave" }); // Wave 11: ids 21 (Lane 0) and 22 (Lane 1)
    stepUntil(run, (s) => s.vectoids.some((v) => v.lane === 1 && v.y > 0), 200);
    const before = run.snapshot();
    const walker = before.vectoids.find((v) => v.lane === 1);
    expect(walker?.id).toBe(22);
    const distance = walker === undefined ? NaN : Math.hypot(walker.x - LASER_CENTRE.x, walker.y - LASER_CENTRE.y);
    expect(distance).toBeGreaterThan(GL1_RANGE);
    expect(distance).toBeLessThan(GL1_RANGE * 1.25);
    expect(tower(before, 2).targetId).toBeNull();
    expect(before.beams).toEqual([]);

    placeBooster(run, "rangeBooster", { col: 3, row: 0 });
    expect(tower(run.snapshot(), 2).targetId).toBeNull(); // nothing fires until the next step
    const events = run.step();
    const after = run.snapshot();
    // The 1-hp Vectoid dies to the first hit, so the kill names the target the laser picked.
    expect(eventsOfType(events, "killed")).toEqual([{ type: "killed", tick: before.tick, vectoidId: 22, towerId: 2, bounty: expect.any(Number) as number }]);
    expect(after.vectoids.some((v) => v.id === 22)).toBe(false);
    expect(after.vectoids.some((v) => v.id === 21)).toBe(true); // Lane 0's is still out of Range
  });

  it("without the Booster the same Vectoid walks its first two Cells untouched", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeLaser(run, LASER_CELL);
    must(run, { type: "sendWave" });
    stepUntil(run, (s) => s.vectoids.some((v) => v.lane === 1 && v.y > 0), 200);
    const events = stepTicks(run, 60); // half a second: 0.8 Cells further down column 2
    expect(eventsOfType(events, "killed")).toEqual([]);
    expect(tower(run.snapshot(), 2).targetId).toBeNull();
  });
});

describe("recomputing buffs when a Tower is placed or sold (towers research 1.4)", () => {
  it("placing a Tower buffs the new Tower by its own distance and leaves the others' buffs as they were", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", { col: 3, row: 0 }); // Booster 1
    placeLaser(run, { col: 4, row: 0 }); // Tower 2, 1 Cell away: inside
    placeLaser(run, { col: 8, row: 0 }); // Tower 3, 5 Cells away: outside
    const first = run.snapshot();
    expect(tower(first, 2)).toMatchObject({ damageBuff: BOOSTER_PERCENT, damage: 27.5 });
    expect(tower(first, 3)).toMatchObject({ damageBuff: 0, damage: GL1_DAMAGE });

    placeLaser(run, { col: 5, row: 0 }); // Tower 4, 2 Cells away: inside
    const second = run.snapshot();
    expect(tower(second, 2)).toMatchObject({ damageBuff: BOOSTER_PERCENT, damage: 27.5 });
    expect(tower(second, 3)).toMatchObject({ damageBuff: 0, damage: GL1_DAMAGE });
    expect(tower(second, 4)).toMatchObject({ damageBuff: BOOSTER_PERCENT, damage: 27.5 });
  });

  it("selling a Tower recomputes: the remaining Towers keep the buffs their own distances give them", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", { col: 3, row: 0 }); // Booster 1
    placeBooster(run, "rangeBooster", { col: 6, row: 0 }); // Booster 2
    placeLaser(run, { col: 4, row: 0 }); // Tower 2: 1 from Booster 1, 2 from Booster 2
    placeLaser(run, { col: 8, row: 0 }); // Tower 3: 5 from Booster 1, 2 from Booster 2
    placeLaser(run, { col: 5, row: 0 }); // Tower 4: 2 from Booster 1, 1 from Booster 2
    const before = run.snapshot();
    expect(tower(before, 2)).toMatchObject({ damageBuff: BOOSTER_PERCENT, rangeBuff: BOOSTER_PERCENT });
    expect(tower(before, 3)).toMatchObject({ damageBuff: 0, rangeBuff: BOOSTER_PERCENT });
    expect(tower(before, 4)).toMatchObject({ damageBuff: BOOSTER_PERCENT, rangeBuff: BOOSTER_PERCENT });

    must(run, { type: "sell", towerId: 2 });
    const after = run.snapshot();
    expect(after.towers.map((t) => t.id)).toEqual([3, 4]);
    expect(after.boosters).toHaveLength(2); // Boosters are never removed
    expect(tower(after, 3)).toMatchObject({ damageBuff: 0, rangeBuff: BOOSTER_PERCENT, damage: GL1_DAMAGE });
    expect(tower(after, 4)).toMatchObject({ damageBuff: BOOSTER_PERCENT, rangeBuff: BOOSTER_PERCENT, damage: 27.5 });
    expect(tower(after, 4).range).toBeCloseTo(3.5, 12);

    // Selling the last buffed Tower changes nothing for the unbuffed one.
    must(run, { type: "sell", towerId: 4 });
    expect(tower(run.snapshot(), 3)).toMatchObject({ damageBuff: 0, rangeBuff: BOOSTER_PERCENT });
  });

  it("a Booster placed later buffs every Tower already inside its radius and no other", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeLaser(run, { col: 3, row: 0 }); // Tower 2
    placeLaser(run, { col: 8, row: 0 }); // Tower 3
    placeBooster(run, "damageBooster", { col: 4, row: 0 }); // 1 from Tower 2, 4 from Tower 3
    const s = run.snapshot();
    expect(tower(s, 2).damageBuff).toBe(BOOSTER_PERCENT);
    expect(tower(s, 3).damageBuff).toBe(0);
  });
});

describe("a Booster cannot be sold (towers research Addendum 2026-09-12)", () => {
  // The v1.2 source hides button_sell for Type "buffD" and "buffR" and only
  // button_sell calls sell(n), so a placed Booster is permanent: its Cell
  // stays occupied for the rest of the Run and the Bonus Point is never
  // refunded. The sim follows suit: there is no sell-Booster Command.

  it("there is no sell-Booster Command on the seam", () => {
    expectTypeOf<Extract<CommandType, "sellBooster" | "removeBooster">>().toEqualTypeOf<never>();
  });

  it("sell with a Booster's id is rejected with noSuchTower: ids are Tower ids, and Boosters live in their own id space", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", { col: 3, row: 0 }); // Booster 1; no Tower 1 exists any more
    expect(rejection(run, { type: "sell", towerId: 1 })).toBe("noSuchTower");
    placeLaser(run, { col: 5, row: 0 }); // Tower 2
    expect(rejection(run, { type: "sell", towerId: 1 })).toBe("noSuchTower");
    expect(rejection(run, { type: "upgrade", towerId: 1 })).toBe("noSuchTower");
    const s = run.snapshot();
    expect(s.boosters).toEqual([{ id: 1, kind: "damageBooster", cell: { col: 3, row: 0 } }]);
    expect(s.towers.map((t) => t.id)).toEqual([2]);
    expect(eventsOfType(run.step(), "towerSold")).toEqual([]);
  });

  it("the Booster's Cell stays occupied and the Bonus Point is not refunded", () => {
    const run = emptyGridWithTwoBonusPoints();
    placeBooster(run, "damageBooster", { col: 3, row: 0 });
    run.apply(at(run, { type: "sell", towerId: 1 })); // rejected: noSuchTower
    stepTicks(run, 120);
    const s = run.snapshot();
    expect(s.economy.bonusPoints).toBe(1);
    expect(s.boosters).toHaveLength(1);
    expect(rejection(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 3, row: 0 } })).toBe("cellOccupied");
    expect(rejection(run, { type: "placeBooster", kind: "rangeBooster", cell: { col: 3, row: 0 } })).toBe("cellOccupied");
    expect(s.economy.bank).toBe(run.snapshot().economy.bank);
  });
});
