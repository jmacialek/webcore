/**
 * M1-05: Send gating, Auto, Interest, and Score on Send.
 * Numbers: waves-and-economy research 2 (Send gate, Interest, Auto) and 3
 * (Score formula); v1.2 verification 5 (Interest paid in `wave()` for
 * `level > 1`); waves research 1.1 and 1.2 (next-Wave preview).
 */
import { describe, expect, it } from "vitest";
import { createRun, original, switchback, waveStats } from "../src/index.js";
import type { Run, SimEvent } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/**
 * One-hit Vectoids: Green Laser 1 lands 22 dmg 40 times a second (towers
 * research 1.1), so even at 50% against Red Shredders one tick kills a
 * 1 hp Vectoid on contact.
 */
const oneHit = overrideRuleset(original, { startHp: 1, suffix: "send-onehit" });
/** No Towers and no Send gate: Sends back to back to watch Bank and Score alone. */
const ungated = overrideRuleset(original, { maxAliveToSend: 100_000, suffix: "send-ungated" });

/**
 * A buildable Cell beside the Entry whose 2.8 Range covers the first six
 * Cells of both Lanes (Lane 0 down column 1 to row 3, Lane 1 down column 2
 * to row 2, then both turn right).
 */
const LASER_CELL = { col: 3, row: 1 };

function oneHitRun(seed = 1): Run {
  const run = createRun({ ruleset: oneHit, map: switchback, seed });
  expect(switchback.isBuildable(LASER_CELL)).toBe(true);
  must(run, { type: "placeTower", kind: "greenLaser1", cell: LASER_CELL });
  return run;
}

function ungatedRun(seed = 1): Run {
  return createRun({ ruleset: ungated, map: switchback, seed });
}

function ticksOf(events: readonly SimEvent[]): Set<number> {
  return new Set(events.map((e) => e.tick));
}

describe("Send gating (waves research 2: Send enabled while creepArray.length <= 10)", () => {
  it("a fresh Run can Send with no Vectoids alive", () => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    expect(run.snapshot().wave).toMatchObject({ alive: 0, canSend: true, current: 0 });
  });

  it("with 28 Vectoids alive Send is unavailable and sendWave is rejected with sendUnavailable and no state change", () => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    run.step();
    const before = run.snapshot();
    expect(before.wave).toMatchObject({ alive: 28, canSend: false, current: 1 });
    expect(run.apply(at(run, { type: "sendWave" }))).toEqual({ ok: false, reason: "sendUnavailable" });
    expect(run.snapshot()).toEqual(before);
    expect(run.log().at(-1)).toEqual({ command: { type: "sendWave", tick: before.tick }, result: { ok: false, reason: "sendUnavailable" } });
  });

  it("canSend tracks alive <= 10 on every tick and flips to true the tick the eleventh Vectoid dies", () => {
    const run = oneHitRun();
    must(run, { type: "sendWave" });
    let firstOpenTick: number | null = null;
    let aliveBefore = 0;
    for (let i = 0; i < 2000 && firstOpenTick === null; i += 1) {
      run.step();
      const s = run.snapshot();
      expect(s.wave.canSend).toBe(s.wave.alive <= 10); // waves research 2
      if (s.wave.alive <= 10) firstOpenTick = s.tick;
      else aliveBefore = s.wave.alive;
    }
    expect(firstOpenTick).not.toBeNull();
    // A single Green Laser 1 kills one Vectoid per acquisition, so the count stepped from 11 to 10.
    expect(aliveBefore).toBe(11);
    expect(run.snapshot().wave).toMatchObject({ alive: 10, canSend: true, current: 1 });
    expect(run.snapshot().economy.lives).toBe(20);
  });

  it("sendWave is rejected at eleven alive and accepted at ten, and the new Wave closes the gate again", () => {
    const run = oneHitRun();
    must(run, { type: "sendWave" });
    stepUntil(run, (s) => s.wave.alive === 11, 2000);
    expect(run.snapshot().wave.canSend).toBe(false);
    expect(run.apply(at(run, { type: "sendWave" }))).toEqual({ ok: false, reason: "sendUnavailable" });
    stepUntil(run, (s) => s.wave.alive === 10, 2000);
    expect(run.snapshot().wave.canSend).toBe(true);
    must(run, { type: "sendWave" });
    const events = run.step();
    expect(eventsOfType(events, "waveSent")).toHaveLength(1);
    const s = run.snapshot();
    expect(s.wave.current).toBe(2);
    // Ten survivors of Wave 1 plus 28 of Wave 2, less any the Laser took this tick.
    expect(s.wave.alive).toBeGreaterThanOrEqual(37);
    expect(s.wave.alive).toBeLessThanOrEqual(38);
    expect(s.wave.canSend).toBe(false);
  });
});

describe("Interest and Score on Send (waves research 2 and 3; verification 5)", () => {
  it("the first Send pays no Interest and gains no Score (v1.2: `if (level > 1)`)", () => {
    const run = ungatedRun();
    must(run, { type: "sendWave" });
    const events = run.step();
    expect(eventsOfType(events, "interestPaid")).toEqual([]);
    expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick: 0, wave: 1 }]);
    expect(run.snapshot().economy).toMatchObject({ bank: 275, score: 0, interest: 3 });
  });

  it("later Sends pay trunc(bank / 100 * interest) into the Bank and raise Score by trunc(bank / 100 * interest * 2) on the pre-Interest Bank", () => {
    const run = ungatedRun();
    must(run, { type: "sendWave" });
    run.step();
    const seen: { tick: number; amount: number; scoreGained: number; bank: number; score: number }[] = [];
    for (let wave = 2; wave <= 4; wave += 1) {
      must(run, { type: "sendWave" });
      const events = run.step();
      const paid = eventsOfType(events, "interestPaid");
      expect(paid).toHaveLength(1);
      const [p] = paid;
      if (p === undefined) throw new Error("no interestPaid Event");
      expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick: p.tick, wave }]);
      // Interest lands before the Wave is announced, as in `wave()`.
      expect(events.indexOf(p)).toBeLessThan(events.findIndex((e) => e.type === "waveSent"));
      const { bank, score } = run.snapshot().economy;
      seen.push({ tick: p.tick, amount: p.amount, scoreGained: p.scoreGained, bank, score });
    }
    // Bank 275 -> trunc(8.25) = 8, Score trunc(16.5) = 16 (waves research 2, 3).
    // Bank 283 -> trunc(8.49) = 8, Score trunc(16.98) = 16.
    // Bank 291 -> trunc(8.73) = 8, Score trunc(17.46) = 17: Score is not simply twice the
    // Interest paid, and 17 only comes out on the pre-Interest Bank (post would be 299 -> 17.94 -> 17
    // too, but for Bank 283 the post-Interest 291 would give 17 where the research says 16).
    expect(seen).toEqual([
      { tick: 1, amount: 8, scoreGained: 16, bank: 283, score: 16 },
      { tick: 2, amount: 8, scoreGained: 16, bank: 291, score: 32 },
      { tick: 3, amount: 8, scoreGained: 17, bank: 299, score: 49 },
    ]);
  });

  it("Interest compounds on the whole Bank Send after Send, and Interest alone carries the Bank past $1,000 by Wave 50", () => {
    // Sell nothing, kill nothing: drive the Bank with Interest alone until it passes 1000.
    const run = ungatedRun();
    must(run, { type: "sendWave" });
    run.step();
    let bank = 275;
    let score = 0;
    for (let wave = 2; wave <= 50; wave += 1) {
      must(run, { type: "sendWave" });
      const [p] = eventsOfType(run.step(), "interestPaid");
      if (p === undefined) throw new Error("no interestPaid Event");
      const expectedPaid = Math.trunc((bank / 100) * 3); // waves research 2
      const expectedScore = Math.trunc((bank / 100) * (3 * 2)); // waves research 3
      expect(p).toEqual({ type: "interestPaid", tick: wave - 1, amount: expectedPaid, scoreGained: expectedScore });
      bank += expectedPaid;
      score += expectedScore;
      expect(run.snapshot().economy).toMatchObject({ bank, score });
    }
    expect(bank).toBeGreaterThan(1000);
  });

  it("an Auto Send pays the same Interest as a manual one, on the Bank after the Wave's Bounties", () => {
    const run = oneHitRun();
    must(run, { type: "setAuto", enabled: true });
    const events = stepUntil(run, (s) => s.wave.current === 2, 4000);
    expect(eventsOfType(events, "leaked")).toEqual([]);
    expect(eventsOfType(events, "killed")).toHaveLength(28);
    // Bank 275 - 100 (Green Laser 1) + 28 * $5 = 315 -> trunc(9.45) = 9; Score 28 * 5 * 100 + trunc(18.9) = 14018.
    expect(eventsOfType(events, "interestPaid")).toEqual([{ type: "interestPaid", tick: run.tick - 1, amount: 9, scoreGained: 18 }]);
    expect(run.snapshot().economy).toMatchObject({ bank: 324, score: 14018 });
  });
});

describe("Auto (waves research 2: autoLevel)", () => {
  it("enabling Auto on an empty field Sends at once", () => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    must(run, { type: "setAuto", enabled: true });
    const events = run.step();
    expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick: 0, wave: 1 }]);
    expect(eventsOfType(events, "spawned")).toHaveLength(28);
    expect(run.snapshot().wave).toMatchObject({ current: 1, alive: 28, auto: true, canSend: false });
  });

  it("enabling Auto while Vectoids are alive does not Send until every one of them is dead", () => {
    const run = oneHitRun();
    must(run, { type: "sendWave" });
    stepTicks(run, 100);
    must(run, { type: "setAuto", enabled: true });
    const first = run.step();
    expect(eventsOfType(first, "waveSent")).toEqual([]);
    expect(run.snapshot().wave).toMatchObject({ current: 1, auto: true });
    const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "waveSent"), 4000);
    expect(run.snapshot().wave.current).toBe(2);
    // The tick the last Vectoid of Wave 1 dies is the tick Wave 2 is Sent.
    const lastKill = eventsOfType(events, "killed").at(-1);
    const cleared = eventsOfType(events, "waveCleared");
    const sent = eventsOfType(events, "waveSent");
    expect(cleared).toEqual([{ type: "waveCleared", tick: lastKill?.tick, wave: 1 }]);
    expect(sent).toEqual([{ type: "waveSent", tick: lastKill?.tick, wave: 2 }]);
    const tick = lastKill?.tick;
    const thatTick = events.filter((e) => e.tick === tick);
    expect(thatTick.map((e) => e.type).slice(0, 4)).toEqual(["killed", "waveCleared", "interestPaid", "waveSent"]);
    expect(eventsOfType(thatTick, "spawned")).toHaveLength(28);
    expect(ticksOf(eventsOfType(thatTick, "spawned"))).toEqual(new Set([tick]));
    expect(run.snapshot().wave.alive).toBe(28);
  });

  it("with Auto off, clearing a Wave only opens the gate", () => {
    const run = oneHitRun();
    must(run, { type: "sendWave" });
    const events = stepUntil(run, (s) => s.wave.alive === 0, 4000);
    expect(eventsOfType(events, "waveCleared")).toEqual([{ type: "waveCleared", tick: run.tick - 1, wave: 1 }]);
    expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick: 0, wave: 1 }]);
    expect(run.snapshot().wave).toMatchObject({ current: 1, alive: 0, canSend: true, auto: false });
    stepTicks(run, 200);
    expect(run.snapshot().wave.current).toBe(1);
  });

  it("disabling Auto before a Wave is cleared stops the chain", () => {
    const run = oneHitRun();
    must(run, { type: "setAuto", enabled: true });
    run.step();
    must(run, { type: "setAuto", enabled: false });
    const events = stepUntil(run, (s) => s.wave.alive === 0, 4000);
    expect(eventsOfType(events, "waveSent")).toEqual([]);
    expect(run.snapshot().wave).toMatchObject({ current: 1, auto: false, canSend: true });
  });

  it("Auto keeps chaining Wave after Wave, each Sent on the tick the previous one is cleared", () => {
    const run = oneHitRun();
    must(run, { type: "setAuto", enabled: true });
    const events = stepUntil(run, (s) => s.wave.current === 4, 6000);
    const sent = eventsOfType(events, "waveSent");
    const cleared = eventsOfType(events, "waveCleared");
    expect(sent.map((e) => e.wave)).toEqual([1, 2, 3, 4]);
    expect(cleared.map((e) => e.wave)).toEqual([1, 2, 3]);
    expect(sent.slice(1).map((e) => e.tick)).toEqual(cleared.map((e) => e.tick));
    expect(eventsOfType(events, "interestPaid").map((e) => e.tick)).toEqual(cleared.map((e) => e.tick));
    expect(eventsOfType(events, "leaked")).toEqual([]);
  });
});

describe("next-Wave preview (waves research 1.1 and 1.2)", () => {
  function expectedPreview(wave: number): unknown {
    const entry = original.waves[wave - 1];
    if (entry === undefined) throw new Error(`no Wave ${String(wave)}`);
    const stats = waveStats(original, "easy", wave);
    return {
      wave,
      entry,
      displayName: entry === "mixed" ? "All types" : original.vectoids[entry].displayName,
      hp: stats.hp,
      bounty: stats.bounty,
      bonus: wave % 5 === 0, // waves 1.1: bonusEvery = 5
    };
  }

  it("matches the Ruleset table for every coming Wave from 1 to 50", () => {
    const run = ungatedRun();
    for (let wave = 1; wave <= 50; wave += 1) {
      expect(run.snapshot().wave.next).toEqual(expectedPreview(wave));
      must(run, { type: "sendWave" });
      run.step();
    }
  });

  it("previews Wave 5 as Hard Grey with a Bonus Cell at 1,133 hp and $9", () => {
    const run = ungatedRun();
    for (let wave = 1; wave <= 4; wave += 1) {
      must(run, { type: "sendWave" });
      run.step();
    }
    expect(run.snapshot().wave.next).toEqual({ wave: 5, entry: "hardGrey", displayName: "Hard Grey", hp: 1133, bounty: 9, bonus: true });
  });

  it("previews Wave 50 as All types (mixed) at 1,527,338 hp and $54 with a Bonus Cell", () => {
    const run = ungatedRun();
    for (let wave = 1; wave <= 49; wave += 1) {
      must(run, { type: "sendWave" });
      run.step();
    }
    expect(run.snapshot().wave).toMatchObject({ current: 49, canSend: true });
    expect(run.snapshot().wave.next).toEqual({ wave: 50, entry: "mixed", displayName: "All types", hp: 1_527_338, bounty: 54, bonus: true });
  });

  it("after Wave 50 is Sent the preview is null, Send is unavailable, and sendWave is rejected", () => {
    const run = ungatedRun();
    for (let wave = 1; wave <= 50; wave += 1) {
      must(run, { type: "sendWave" });
      run.step();
    }
    const s = run.snapshot();
    expect(s.wave).toMatchObject({ current: 50, total: 50, next: null, canSend: false });
    expect(s.outcome).toBeNull();
    expect(run.apply(at(run, { type: "sendWave" }))).toEqual({ ok: false, reason: "sendUnavailable" });
    // Auto on an empty-of-Waves Run has nothing left to Send either.
    stepTicks(run, 1);
    expect(run.snapshot().wave.next).toBeNull();
  });
});
