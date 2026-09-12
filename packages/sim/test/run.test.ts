/**
 * M1-04: Run skeleton. Waves, movement, Leaks, run end, replay harness.
 * Numbers: waves-and-economy research 1.1, 1.2, 2, 4; maps research
 * (Switchback Lane lengths 102.8 and 100.8 Cells); spec "Units and time".
 */
import { describe, expect, it } from "vitest";
import { createRun, original, replayRun, switchback, waveTable, TICKS_PER_SECOND } from "../src/index.js";
import type { Command, Run } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil, stepUntilEnded } from "./helpers/run.js";

function fresh(seed = 1): Run {
  return createRun({ ruleset: original, map: switchback, seed });
}

describe("a new Run on Switchback under Original", () => {
  it("starts with $275, 20 Lives, 3% Interest, 0 Score, 0 Bonus Points (economy research 2)", () => {
    const s = fresh().snapshot();
    expect(s.economy).toEqual({ bank: 275, lives: 20, interest: 3, score: 0, bonusPoints: 0 });
    expect(s.wave).toMatchObject({ current: 0, total: 50, alive: 0, canSend: true, auto: false });
    expect(s.outcome).toBeNull();
    expect(s.vectoids).toEqual([]);
    expect(s.tick).toBe(0);
  });

  it("previews Wave 1 as 28 Blue Spinners at 550 hp and $5", () => {
    const s = fresh().snapshot();
    expect(s.wave.next).toEqual({ wave: 1, entry: "blueSpinner", displayName: "Blue Spinner", hp: 550, bounty: 5, bonus: false });
  });
});

describe("Sending a Wave", () => {
  it("spawns fourteen Vectoids per Lane, 0.8 Cells apart, queued behind the Entry (spec Units and time)", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    const events = run.step();
    expect(eventsOfType(events, "waveSent")).toEqual([{ type: "waveSent", tick: 0, wave: 1 }]);
    expect(eventsOfType(events, "spawned")).toHaveLength(28);
    const s = run.snapshot();
    expect(s.wave.current).toBe(1);
    expect(s.wave.alive).toBe(28);
    const lane0 = s.vectoids.filter((v) => v.lane === 0);
    const lane1 = s.vectoids.filter((v) => v.lane === 1);
    expect(lane0).toHaveLength(14);
    expect(lane1).toHaveLength(14);
    // Lane 0 spawns first, so its ids come first.
    expect(lane0.map((v) => v.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    // After one tick each has moved 1.6 / 120 Cells from -0.8 * i.
    const dt = 1.6 / TICKS_PER_SECOND;
    lane0.forEach((v, i) => {
      expect(v.distance).toBeCloseTo(-0.8 * i + dt, 12);
      expect(v.type).toBe("blueSpinner");
      expect(v.hp).toBe(550);
      expect(v.maxHp).toBe(550);
      expect(v.speed).toBeCloseTo(1.6, 12);
      expect(v.bounty).toBe(5);
    });
    // The first Vectoid of Lane 0 is at its Entry column.
    expect(lane0[0]?.x).toBeCloseTo(1.6, 12);
  });

  it("walks the Lane at 1.6 Cells per second", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    stepTicks(run, TICKS_PER_SECOND * 10);
    const lead = run.snapshot().vectoids[0];
    expect(lead?.distance).toBeCloseTo(16, 6);
    // 16 Cells along Lane 0: down 3.8 to (1.6, 3.4) then 12.2 right.
    expect(lead?.x).toBeCloseTo(13.8, 6);
    expect(lead?.y).toBeCloseTo(3.4, 6);
  });
});

describe("Leaks and defeat with no Towers (lives research 4)", () => {
  it("each Leak costs one Life, teleports the Vectoid to its Lane's Entry, and Lives reach 0 at the 20th Leak", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    const events = stepUntilEnded(run, 20_000);
    const leaks = eventsOfType(events, "leaked");
    expect(leaks).toHaveLength(20);
    expect(leaks.map((l) => l.livesLeft)).toEqual([19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    // Lane 1 is 100.8 Cells so its leader Leaks first at 63 s; interleaving
    // the two Lanes at 0.5 s spacing puts the 20th Leak at 68.25 s.
    expect(leaks[0]?.tick).toBeGreaterThanOrEqual(63 * TICKS_PER_SECOND - 2);
    expect(leaks[0]?.tick).toBeLessThanOrEqual(63 * TICKS_PER_SECOND);
    const ended = eventsOfType(events, "runEnded");
    expect(ended).toHaveLength(1);
    expect(ended[0]?.outcome).toBe("defeat");
    expect(ended[0]?.tick).toBeGreaterThanOrEqual(68.25 * TICKS_PER_SECOND - 2);
    expect(ended[0]?.tick).toBeLessThanOrEqual(68.25 * TICKS_PER_SECOND);
    const s = run.snapshot();
    expect(s.outcome).toBe("defeat");
    expect(s.economy.lives).toBe(0);
    // Leaked Vectoids restarted at their Lane's Entry and are still alive.
    expect(s.wave.alive).toBe(28);
    // The first leaker restarted at 63 s and walked 5.25 s more at 1.6 Cells/s.
    const leaked = s.vectoids.find((v) => v.id === leaks[0]?.vectoidId);
    expect(leaked?.distance).toBeCloseTo(8.4, 1);
  });

  it("Score never drops below zero on a Leak", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    stepUntil(run, (_s, e) => e.some((x) => x.type === "leaked"), 20_000);
    expect(run.snapshot().economy.score).toBe(0);
  });

  it("after the Run ends, stepping is a no-op except for the tick counter, and Commands are rejected", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    stepUntilEnded(run, 20_000);
    const before = run.snapshot();
    expect(run.step()).toEqual([]);
    expect(run.snapshot()).toEqual({ ...before, tick: before.tick + 1 });
    expect(run.apply(at(run, { type: "sendWave" }))).toEqual({ ok: false, reason: "runEnded" });
  });
});

describe("with Lives raised by a test-only Ruleset override", () => {
  // Lives raised so nothing ends the Run; the Send gate lifted so Waves can
  // be Sent with no Towers (M1-05 tests the gate itself).
  const generous = overrideRuleset(original, { lives: 100_000, maxAliveToSend: 100_000, suffix: "lives" });

  it("all 28 Vectoids of Wave 1 Leak, once each, within 71 s", () => {
    const run = createRun({ ruleset: generous, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    const events = stepTicks(run, 71 * TICKS_PER_SECOND);
    const leaks = eventsOfType(events, "leaked");
    expect(leaks).toHaveLength(28);
    expect(new Set(leaks.map((l) => l.vectoidId)).size).toBe(28);
    expect(run.snapshot().economy.lives).toBe(100_000 - 28);
  });

  it("reaches Wave 50 by Sending each Wave the moment Send is available, and the first Vectoid of every Wave has the research hit points and Bounty (waves research 1.2)", () => {
    const run = createRun({ ruleset: generous, map: switchback, seed: 1 });
    const table = waveTable(original, "easy");
    const seen: { hp: number; bounty: number }[] = [];
    for (let wave = 1; wave <= 50; wave += 1) {
      expect(run.snapshot().wave.canSend).toBe(true);
      must(run, { type: "sendWave" });
      const events = run.step();
      const first = eventsOfType(events, "spawned")[0];
      const v = run.snapshot().vectoids.find((c) => c.id === first?.vectoidId);
      if (v === undefined) throw new Error("no Vectoid spawned");
      seen.push({ hp: v.maxHp, bounty: v.bounty });
      stepTicks(run, 10);
    }
    expect(seen).toEqual(table.map((row) => ({ hp: row.hp, bounty: row.bounty })));
    expect(seen[49]).toEqual({ hp: 1_527_338, bounty: 54 });
    expect(run.snapshot().wave.current).toBe(50);
    expect(run.snapshot().wave.next).toBeNull();
  });
});

describe("determinism and replay (ADR 0003)", () => {
  it("two Runs with the same inputs produce identical per-tick digests", () => {
    const a = fresh(42);
    const b = fresh(42);
    must(a, { type: "sendWave" });
    must(b, { type: "sendWave" });
    for (let i = 0; i < 2000; i += 1) {
      a.step();
      b.step();
      expect(a.digest()).toBe(b.digest());
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it("replay of the serialised Run reproduces the final Snapshot and Score", () => {
    const run = fresh(7);
    must(run, { type: "sendWave" });
    stepTicks(run, 3000);
    const serialised = run.serialise();
    expect(serialised).toMatchObject({ rulesetId: "original", mapId: "switchback", seed: 7, ticks: 3000 });
    expect(serialised.commands).toEqual([{ type: "sendWave", tick: 0 }]);
    const replay = replayRun(serialised);
    expect(replay.snapshot).toEqual(run.snapshot());
    expect(replay.score).toBe(run.snapshot().economy.score);
    expect(replay.finalDigest).toBe(run.digest());
  });

  it("a different Seed still gives the same no-Tower Run, because nothing random has happened yet", () => {
    const a = fresh(1);
    const b = fresh(2);
    must(a, { type: "sendWave" });
    must(b, { type: "sendWave" });
    stepTicks(a, 100);
    stepTicks(b, 100);
    expect(a.snapshot().vectoids).toEqual(b.snapshot().vectoids);
    expect(a.digest()).not.toBe(b.digest()); // the Seed itself is in the Snapshot
  });
});

describe("invalid Commands are rejected with a reason and no state change", () => {
  it("unknown Tower kind", () => {
    const run = fresh();
    const before = run.snapshot();
    const cmd = { type: "placeTower", tick: 0, kind: "orbitalLaser", cell: { col: 0, row: 0 } } as unknown as Command;
    expect(run.apply(cmd)).toEqual({ ok: false, reason: "unknownTowerKind" });
    expect(run.snapshot()).toEqual(before);
  });

  it("out-of-order tick, in both directions", () => {
    const run = fresh();
    stepTicks(run, 5);
    const before = run.snapshot();
    expect(run.apply({ type: "sendWave", tick: 3 })).toEqual({ ok: false, reason: "outOfOrderTick" });
    expect(run.apply({ type: "sendWave", tick: 9 })).toEqual({ ok: false, reason: "outOfOrderTick" });
    expect(run.snapshot()).toEqual(before);
    expect(run.snapshot().wave.current).toBe(0);
  });

  it("an out-of-order Command never enters the Command Log, because it applied at no tick", () => {
    const run = fresh();
    stepTicks(run, 5);
    run.apply({ type: "sendWave", tick: 3 });
    expect(run.log()).toEqual([]);
  });

  it("rejected Commands stay in the log and replay skips them identically", () => {
    const run = fresh();
    must(run, { type: "sendWave" });
    stepTicks(run, 5);
    // Send is unavailable with 28 alive: rejected, logged, and replayed as rejected.
    expect(run.apply(at(run, { type: "sendWave" }))).toEqual({ ok: false, reason: "sendUnavailable" });
    stepTicks(run, 100);
    const log = run.log();
    expect(log.map((e) => e.result)).toEqual([{ ok: true }, { ok: false, reason: "sendUnavailable" }]);
    const replay = replayRun(run.serialise());
    expect(replay.results).toEqual(log.map((e) => e.result));
    expect(replay.snapshot).toEqual(run.snapshot());
  });

  it("a hostile log whose ticks go backwards is rejected tick by tick with no state change", () => {
    const run = fresh();
    stepTicks(run, 10);
    must(run, { type: "setAuto", enabled: true });
    stepTicks(run, 40);
    const serialised = run.serialise();
    // A second Command stamped earlier than the first: applied at no tick.
    const hostile = { ...serialised, commands: [...serialised.commands, { type: "sendWave", tick: 3 } as const] };
    const replay = replayRun(hostile);
    expect(replay.results).toEqual([{ ok: true }, { ok: false, reason: "outOfOrderTick" }]);
    expect(replay.snapshot).toEqual(run.snapshot());
  });
});
