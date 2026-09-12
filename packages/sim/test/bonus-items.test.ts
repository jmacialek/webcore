/**
 * M1-13: the instant Bonus Items, Interest Increase and Panic.
 * Numbers: towers research 1.4 (each item costs 1 Bonus Point; Interest
 * Increase `interest += 3`; Panic `lives += 5`); v1.2 verification 5
 * (3% -> 6% after one purchase, Interest paid on Send as
 * `int(bank / 100 * interest)`); waves-and-economy research 3 (Score on
 * Send is trunc(bank / 100 * interest * 2)).
 *
 * Method for earning a Bonus Point (as in colour-rule.test.ts): under a
 * test-only Ruleset with every Wave at 1 hp (the Bonus Cell at 4) and the
 * Send gate lifted, Send Waves 1..4 at tick 0 and walk them 15 s clear of
 * the Entry; then Send Wave 5 with a Green Laser 1 by the Entry switched to
 * Hard, so the 4-hp Bonus Cell is picked over the 1-hp Hard Greys, and step
 * until `bonusPointEarned`.
 */
import { describe, expect, it } from "vitest";
import { createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Run } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Every Wave at 1 hp (the Bonus Cell at 4) and every Wave Sendable at once; Lives stay at the real 20. */
const oneHp = overrideRuleset(original, { startHp: 1, maxAliveToSend: 100_000, suffix: "bonus-items" });

/** A Cell by the Entry within Range of both Lanes' first Cells. */
const BY_THE_ENTRY = { col: 0, row: 0 } as const;

/** Interest starts at 3 points and each Interest Increase adds 3 (towers research 1.4, 1.5). */
const START_INTEREST = 3;
const INTEREST_STEP = 3;
/** Panic grants 5 Lives (towers research 1.4). */
const PANIC_LIVES = 5;
/** Score on Send is Interest x 2 on the pre-Interest Bank (waves research 3). */
const INTEREST_SCORE_MULTIPLIER = 2;

/** Wave 5's Bonus Cell is Lane 1's fourteenth, id 140 after four Waves of 28. */
const WAVE_5_CELL = 140;

/** Kill Wave 5's Bonus Cell: returns a Run with one Bonus Point and Tower 1 (Green Laser 1, Hard) by the Entry. */
function runWithOneBonusPoint(): Run {
  const run = createRun({ ruleset: oneHp, map: switchback, seed: 1 });
  for (let wave = 1; wave <= 4; wave += 1) must(run, { type: "sendWave" });
  stepTicks(run, 15 * TICKS_PER_SECOND);
  must(run, { type: "sendWave" });
  must(run, { type: "placeTower", kind: "greenLaser1", cell: BY_THE_ENTRY });
  must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
  const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "bonusPointEarned"), 3000);
  expect(eventsOfType(events, "bonusPointEarned")).toEqual([{ type: "bonusPointEarned", tick: run.tick - 1, vectoidId: WAVE_5_CELL }]);
  expect(run.snapshot().economy.bonusPoints).toBe(1);
  return run;
}

describe("Interest Increase (towers research 1.4; v1.2 verification 5)", () => {
  it("spends the Bonus Point and takes Interest from 3 to 6 points, with a bonusItemUsed Event on the next step", () => {
    const run = runWithOneBonusPoint();
    const before = run.snapshot();
    expect(before.economy).toMatchObject({ interest: START_INTEREST, bonusPoints: 1 });
    const tick = run.tick;
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    const after = run.snapshot();
    expect(after.economy.interest).toBe(START_INTEREST + INTEREST_STEP);
    expect(after.economy.bonusPoints).toBe(0);
    // Nothing else moves: Bank, Lives and Score are untouched by the purchase.
    expect(after.economy).toMatchObject({ bank: before.economy.bank, lives: before.economy.lives, score: before.economy.score });
    const events = run.step();
    expect(eventsOfType(events, "bonusItemUsed")).toEqual([{ type: "bonusItemUsed", tick, item: "interestIncrease" }]);
    expect(run.log().at(-1)).toEqual({ command: { type: "useBonusItem", tick, item: "interestIncrease" }, result: { ok: true } });
  });

  it("the next Send pays 6% of the Bank: amount trunc(bank / 100 * 6) and Score trunc(bank / 100 * 12)", () => {
    const run = runWithOneBonusPoint();
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    // Sell the Tower so nothing but Interest moves the Bank on the Send tick.
    must(run, { type: "sell", towerId: 1 });
    run.step();
    const before = run.snapshot();
    expect(before.economy.interest).toBe(6);
    expect(before.towers).toEqual([]);
    const bank = before.economy.bank;
    expect(bank).toBeGreaterThan(100); // a known Bank big enough for a non-zero payment
    const expectedPaid = Math.trunc((bank / 100) * 6); // v1.2 verification 5
    const expectedScore = Math.trunc((bank / 100) * 6 * INTEREST_SCORE_MULTIPLIER); // waves research 3
    expect(expectedPaid).toBeGreaterThan(0);
    // The same Bank at the old 3% would have paid less: the raise is real.
    expect(expectedPaid).toBeGreaterThan(Math.trunc((bank / 100) * START_INTEREST));

    const tick = run.tick;
    must(run, { type: "sendWave" });
    const events = run.step();
    expect(eventsOfType(events, "interestPaid")).toEqual([{ type: "interestPaid", tick, amount: expectedPaid, scoreGained: expectedScore }]);
    expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick, wave: 6 }]);
    expect(eventsOfType(events, "killed")).toEqual([]);
    const after = run.snapshot().economy;
    expect(after.bank).toBe(bank + expectedPaid);
    expect(after.score).toBe(before.economy.score + expectedScore);
    expect(after.interest).toBe(6);
  });

  it("two purchases stack: Wave 5's and Wave 10's Bonus Cells take Interest 3 -> 6 -> 9 (no cap)", () => {
    const run = runWithOneBonusPoint();
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    expect(run.snapshot().economy.interest).toBe(6);
    // Send Waves 6..10 together; the Hard Laser picks Wave 10's 4-hp Bonus Cell once it is in Range.
    for (let wave = 6; wave <= 10; wave += 1) must(run, { type: "sendWave" });
    const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "bonusPointEarned"), 3000);
    const earned = eventsOfType(events, "bonusPointEarned");
    expect(earned).toHaveLength(1);
    const cell = earned[0]?.vectoidId;
    // Wave 10's Bonus Cell is Lane 1's fourteenth: id 280 after nine Waves of 28.
    expect(cell).toBe(280);
    expect(run.snapshot().economy.bonusPoints).toBe(1);
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    expect(run.snapshot().economy).toMatchObject({ interest: 9, bonusPoints: 0 });
  });
});

describe("Panic (towers research 1.4; waves research: Panic +5 Lives)", () => {
  it("spends the Bonus Point and raises Lives from 20 to 25, with a bonusItemUsed Event on the next step", () => {
    const run = runWithOneBonusPoint();
    const before = run.snapshot();
    expect(before.economy).toMatchObject({ lives: 20, bonusPoints: 1 }); // 20 Lives: towers research 1.5
    const tick = run.tick;
    must(run, { type: "useBonusItem", item: "panic" });
    const after = run.snapshot();
    expect(after.economy.lives).toBe(20 + PANIC_LIVES);
    expect(after.economy.bonusPoints).toBe(0);
    // Interest, Bank and Score are untouched.
    expect(after.economy).toMatchObject({ interest: START_INTEREST, bank: before.economy.bank, score: before.economy.score });
    const events = run.step();
    expect(eventsOfType(events, "bonusItemUsed")).toEqual([{ type: "bonusItemUsed", tick, item: "panic" }]);
    expect(run.log().at(-1)).toEqual({ command: { type: "useBonusItem", tick, item: "panic" }, result: { ok: true } });
  });
});

describe("without a Bonus Point (v1.2 verification 2: Bonus Items are unaffordable while `ups <= 0`)", () => {
  it.each(["interestIncrease", "panic"] as const)("%s is rejected with noBonusPoints on a fresh Run and nothing changes", (item) => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    const before = run.snapshot();
    expect(before.economy.bonusPoints).toBe(0);
    expect(run.apply(at(run, { type: "useBonusItem", item }))).toEqual({ ok: false, reason: "noBonusPoints" });
    expect(run.snapshot()).toEqual(before);
    // The rejected Command stays in the log with its result.
    expect(run.log().at(-1)).toEqual({ command: { type: "useBonusItem", tick: before.tick, item }, result: { ok: false, reason: "noBonusPoints" } });
    expect(eventsOfType(run.step(), "bonusItemUsed")).toEqual([]);
  });

  it("the second purchase after a single Bonus Cell kill is rejected: one Bonus Point buys one item", () => {
    const run = runWithOneBonusPoint();
    must(run, { type: "useBonusItem", item: "interestIncrease" });
    const before = run.snapshot();
    expect(before.economy).toMatchObject({ interest: 6, bonusPoints: 0 });
    expect(run.apply(at(run, { type: "useBonusItem", item: "panic" }))).toEqual({ ok: false, reason: "noBonusPoints" });
    expect(run.apply(at(run, { type: "useBonusItem", item: "interestIncrease" }))).toEqual({ ok: false, reason: "noBonusPoints" });
    expect(run.snapshot()).toEqual(before);
    const used = eventsOfType(run.step(), "bonusItemUsed");
    expect(used).toEqual([{ type: "bonusItemUsed", tick: before.tick, item: "interestIncrease" }]);
  });
});

describe("what the seam exposes", () => {
  it("Ruleset carries the Bonus Item numbers: +3 Interest points and +5 Lives (towers research 1.4)", () => {
    expect(original.bonusItems).toMatchObject({ interestIncrease: INTEREST_STEP, panicLives: PANIC_LIVES });
  });
});
