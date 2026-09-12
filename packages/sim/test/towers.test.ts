/**
 * M1-06: Tower placement, economy, and Green Laser 1.
 * Numbers: towers research 1.1 (base stats), 1.2 (upgrades and sell), 1.3
 * (laser mechanics); waves-and-economy research 2 (Bank) and 3 (Score).
 */
import { describe, expect, it } from "vitest";
import { createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { RejectReason, Run, Snapshot, TowerKind, TowerSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil, stepUntilEnded } from "./helpers/run.js";

const GL1_CELL = { col: 3, row: 1 } as const;

function fresh(seed = 1): Run {
  return createRun({ ruleset: original, map: switchback, seed });
}

function withGreenLaser1(run: Run = fresh()): Run {
  must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
  return run;
}

function tower(s: Snapshot, id = 1): TowerSnapshot {
  const t = s.towers.find((x) => x.id === id);
  if (t === undefined) throw new Error(`no Tower ${String(id)} in the Snapshot`);
  return t;
}

// Bank raised so one Green Laser 1 can afford all nine Ranks: 100 + 9 * 50 = 550 (towers research 1.2).
const rich = overrideRuleset(original, { startBank: 1000, suffix: "rich" });

describe("placing a Tower (towers research 1.1; economy research 2)", () => {
  it("Green Laser 1 costs $100: Bank 275 becomes 175 and towerPlaced is emitted", () => {
    const run = fresh();
    expect(switchback.isBuildable(GL1_CELL)).toBe(true);
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    expect(run.snapshot().economy.bank).toBe(175); // towers research 1.1: $100
    const events = run.step();
    expect(eventsOfType(events, "towerPlaced")).toEqual([
      { type: "towerPlaced", tick: 0, towerId: 1, kind: "greenLaser1", cell: { col: 3, row: 1 } },
    ]);
  });

  it("the Snapshot lists the Tower with kind, Cell, Rank, damage, Range, spend, sell value, target, upgrade quotes, mode, and lock", () => {
    const s = withGreenLaser1().snapshot();
    expect(s.towers).toHaveLength(1);
    const t = tower(s);
    expect(t).toMatchObject({
      id: 1,
      kind: "greenLaser1",
      cell: { col: 3, row: 1 },
      rank: 1,
      damage: 22, // towers research 1.1
      baseDamage: 22,
      spend: 100,
      sellValue: 75, // towers research 1.2: trunc(100 / 100 * 75)
      targetId: null,
      upgradeCost: 50, // towers research 1.2: trunc(100 / 2)
      maxUpgrade: { ranks: 3, cost: 150 }, // Bank 175 covers three $50 Ranks
      mode: "close",
      selectableModes: true,
      lockable: false, // v1.2 verification 1.1: lasers are not lockable
      lock: false,
      damageBuff: 0,
      rangeBuff: 0,
    });
    expect(t.range).toBeCloseTo(2.8, 12); // towers research 1.1: 70 px / 25
    expect(t.baseRange).toBeCloseTo(2.8, 12);
    expect(t.cooldown).toBeCloseTo(1 / 40, 12); // towers research 1.1: 40 hits/s
  });
});

describe("placement is rejected with a reason and no state change", () => {
  function expectRejected(run: Run, cell: { col: number; row: number }, reason: RejectReason, kind: TowerKind = "greenLaser1"): void {
    const before = run.snapshot();
    expect(run.apply(at(run, { type: "placeTower", kind, cell }))).toEqual({ ok: false, reason });
    expect(run.snapshot()).toEqual(before);
  }

  it("on a Corridor Cell (cellIsCorridor)", () => {
    const run = fresh();
    for (const cell of [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 1, row: 3 },
      { col: 2, row: 2 },
    ]) {
      expect(switchback.isCorridor(cell)).toBe(true);
      expectRejected(run, cell, "cellIsCorridor");
    }
  });

  it("on an occupied Cell (cellOccupied)", () => {
    const run = withGreenLaser1();
    expectRejected(run, GL1_CELL, "cellOccupied");
    expect(run.snapshot().towers).toHaveLength(1);
  });

  it("off the Grid (cellOffGrid): column 22, row -1, and a non-integer Cell", () => {
    const run = fresh();
    expectRejected(run, { col: 22, row: 0 }, "cellOffGrid");
    expectRejected(run, { col: 0, row: -1 }, "cellOffGrid");
    expectRejected(run, { col: 0, row: 18 }, "cellOffGrid");
    expectRejected(run, { col: 1.5, row: 0 }, "cellOffGrid");
    expectRejected(run, { col: 3, row: 0.25 }, "cellOffGrid");
  });

  it("when the Bank cannot afford it (unaffordable): Red Rockets cost $2500 against $275", () => {
    const run = fresh();
    expectRejected(run, GL1_CELL, "unaffordable", "redRockets"); // towers research 1.1: $2500
    expect(run.snapshot().economy.bank).toBe(275);
  });

  it("checks the Cell before the Bank: Red Rockets on a Corridor Cell is cellIsCorridor", () => {
    expectRejected(fresh(), { col: 1, row: 0 }, "cellIsCorridor", "redRockets");
  });
});

describe("upgrading Green Laser 1 one Rank at a time (towers research 1.2)", () => {
  it("each Rank costs $50, adds 10 damage and 3 px of Range, and emits towerUpgraded; Rank 10 has 112 damage and 97/25 Cells of Range", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    expect(run.snapshot().economy.bank).toBe(900);
    for (let rank = 2; rank <= 10; rank += 1) {
      must(run, { type: "upgrade", towerId: 1 });
      const events = run.step();
      expect(eventsOfType(events, "towerUpgraded")).toEqual([
        { type: "towerUpgraded", tick: rank - 2, towerId: 1, rank, cost: 50 }, // towers research 1.2: trunc(100 / 2)
      ]);
      const t = tower(run.snapshot());
      expect(t.rank).toBe(rank);
      expect(t.damage).toBe(22 + (rank - 1) * 10); // towers research 1.2: trunc(22 / 2.2) = 10 per Rank
      expect(t.baseDamage).toBe(22 + (rank - 1) * 10);
      expect(t.range).toBeCloseTo((70 + (rank - 1) * 3) / 25, 12); // towers research 1.2: trunc(70 / 20) = 3 px per Rank
      expect(t.baseRange).toBeCloseTo((70 + (rank - 1) * 3) / 25, 12);
      expect(t.spend).toBe(100 + (rank - 1) * 50);
      expect(run.snapshot().economy.bank).toBe(900 - (rank - 1) * 50);
    }
    const t = tower(run.snapshot());
    expect(t.rank).toBe(10);
    expect(t.damage).toBe(112); // towers research 1.2
    expect(t.range).toBeCloseTo(3.88, 12); // towers research 1.2: 97 px / 25
    expect(t.baseRange).toBeCloseTo(97 / 25, 12);
    expect(t.spend).toBe(550); // towers research 1.2: 5.5 x base cost
    expect(t.sellValue).toBe(412); // towers research 1.2: trunc(550 / 100 * 75)
    expect(t.upgradeCost).toBeNull();
    expect(t.maxUpgrade).toEqual({ ranks: 0, cost: 0 });
    expect(run.snapshot().economy.bank).toBe(450);
  });

  it("the tenth upgrade is rejected with maxRank and changes nothing", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    for (let i = 0; i < 9; i += 1) must(run, { type: "upgrade", towerId: 1 });
    const before = run.snapshot();
    expect(tower(before).rank).toBe(10);
    expect(run.apply(at(run, { type: "upgrade", towerId: 1 }))).toEqual({ ok: false, reason: "maxRank" });
    expect(run.snapshot()).toEqual(before);
  });

  it("an upgrade the Bank cannot cover is rejected with unaffordable", () => {
    const run = withGreenLaser1();
    // Bank 175: three Ranks at $50, then $25 left.
    for (let i = 0; i < 3; i += 1) must(run, { type: "upgrade", towerId: 1 });
    const before = run.snapshot();
    expect(before.economy.bank).toBe(25);
    expect(run.apply(at(run, { type: "upgrade", towerId: 1 }))).toEqual({ ok: false, reason: "unaffordable" });
    expect(run.snapshot()).toEqual(before);
  });

  it("upgrading an unknown Tower id is rejected with noSuchTower", () => {
    const run = withGreenLaser1();
    expect(run.apply(at(run, { type: "upgrade", towerId: 99 }))).toEqual({ ok: false, reason: "noSuchTower" });
  });
});

describe("Max Upgrade (ADR 0001 improvement 3): the quote equals what the Command spends", () => {
  it("when the Bank covers only some Ranks: Bank 175 quotes 3 Ranks for $150, the Command reaches Rank 4 with $25 left", () => {
    const run = withGreenLaser1();
    expect(tower(run.snapshot()).maxUpgrade).toEqual({ ranks: 3, cost: 150 });
    must(run, { type: "upgradeToMax", towerId: 1 });
    const events = run.step();
    expect(eventsOfType(events, "towerUpgraded")).toEqual([
      { type: "towerUpgraded", tick: 0, towerId: 1, rank: 2, cost: 50 },
      { type: "towerUpgraded", tick: 0, towerId: 1, rank: 3, cost: 50 },
      { type: "towerUpgraded", tick: 0, towerId: 1, rank: 4, cost: 50 },
    ]);
    const s = run.snapshot();
    expect(s.economy.bank).toBe(25);
    expect(tower(s)).toMatchObject({ rank: 4, spend: 250, sellValue: 187, upgradeCost: 50, maxUpgrade: { ranks: 0, cost: 0 } });
    expect(tower(s).damage).toBe(52);
  });

  it("when the Bank covers every Rank: quotes 9 Ranks for $450 and the Command reaches Rank 10 for exactly that", () => {
    const run = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    const quote = tower(run.snapshot()).maxUpgrade;
    expect(quote).toEqual({ ranks: 9, cost: 450 });
    const bankBefore = run.snapshot().economy.bank;
    must(run, { type: "upgradeToMax", towerId: 1 });
    const events = run.step();
    expect(eventsOfType(events, "towerUpgraded").map((e) => e.rank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(eventsOfType(events, "towerUpgraded").reduce((sum, e) => sum + e.cost, 0)).toBe(quote.cost);
    const s = run.snapshot();
    expect(bankBefore - s.economy.bank).toBe(quote.cost);
    expect(tower(s)).toMatchObject({ rank: 10, damage: 112, spend: 550, sellValue: 412, upgradeCost: null, maxUpgrade: { ranks: 0, cost: 0 } });
    expect(tower(s).range).toBeCloseTo(3.88, 12);
  });

  it("at Rank 10 the Command is rejected with maxRank; with less than $50 it is rejected with unaffordable", () => {
    const rich10 = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(rich10, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    must(rich10, { type: "upgradeToMax", towerId: 1 });
    const before10 = rich10.snapshot();
    expect(rich10.apply(at(rich10, { type: "upgradeToMax", towerId: 1 }))).toEqual({ ok: false, reason: "maxRank" });
    expect(rich10.snapshot()).toEqual(before10);

    const poor = withGreenLaser1();
    must(poor, { type: "upgradeToMax", towerId: 1 }); // Rank 4, Bank 25
    const beforePoor = poor.snapshot();
    expect(beforePoor.economy.bank).toBe(25);
    expect(poor.apply(at(poor, { type: "upgradeToMax", towerId: 1 }))).toEqual({ ok: false, reason: "unaffordable" });
    expect(poor.snapshot()).toEqual(beforePoor);
  });
});

describe("selling a Tower (towers research 1.2: 75% of everything spent)", () => {
  it("refunds trunc(spend / 100 * 75), emits towerSold, removes the Tower, and frees the Cell", () => {
    const run = withGreenLaser1();
    must(run, { type: "upgrade", towerId: 1 }); // spend 150, Bank 125
    expect(tower(run.snapshot()).sellValue).toBe(112);
    must(run, { type: "sell", towerId: 1 });
    const events = run.step();
    expect(eventsOfType(events, "towerSold")).toEqual([{ type: "towerSold", tick: 0, towerId: 1, refund: 112 }]);
    const s = run.snapshot();
    expect(s.economy.bank).toBe(125 + 112);
    expect(s.towers).toEqual([]);
    // The Cell is free again; the next Tower takes the next id.
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    expect(run.snapshot().towers.map((t) => ({ id: t.id, cell: t.cell }))).toEqual([{ id: 2, cell: { col: 3, row: 1 } }]);
    expect(run.snapshot().economy.bank).toBe(137);
  });

  it("selling right after placement refunds $75; selling at Rank 10 refunds $412", () => {
    const a = withGreenLaser1();
    must(a, { type: "sell", towerId: 1 });
    expect(a.snapshot().economy.bank).toBe(275 - 100 + 75);

    const b = createRun({ ruleset: rich, map: switchback, seed: 1 });
    must(b, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    must(b, { type: "upgradeToMax", towerId: 1 });
    expect(b.snapshot().economy.bank).toBe(450);
    must(b, { type: "sell", towerId: 1 });
    expect(eventsOfType(b.step(), "towerSold")).toEqual([{ type: "towerSold", tick: 0, towerId: 1, refund: 412 }]);
    expect(b.snapshot().economy.bank).toBe(862);
  });

  it("selling an unknown Tower id is rejected with noSuchTower and changes nothing", () => {
    const run = withGreenLaser1();
    const before = run.snapshot();
    expect(run.apply(at(run, { type: "sell", towerId: 2 }))).toEqual({ ok: false, reason: "noSuchTower" });
    expect(run.snapshot()).toEqual(before);
  });
});

describe("Green Laser 1 firing at Wave 1 (towers research 1.3; economy research 3)", () => {
  it("kills a Blue Spinner in about 550 / 880 s of contact, banks the $5 Bounty, and scores 500", () => {
    const run = withGreenLaser1();
    must(run, { type: "sendWave" });
    // Idle: no beam, no target.
    run.step();
    expect(run.snapshot().beams).toEqual([]);
    expect(tower(run.snapshot()).targetId).toBeNull();

    // First tick of contact: the beam appears and the Tower holds its target.
    stepUntil(run, (s) => s.beams.length > 0, 600);
    const contact = run.snapshot();
    const firstContactTick = contact.tick - 1;
    const beam = contact.beams[0];
    if (beam === undefined) throw new Error("no beam");
    expect(beam).toEqual({ towerId: 1, targetIds: [beam.targetIds[0]], charge: 1 });
    const targetId = beam.targetIds[0];
    if (targetId === undefined) throw new Error("beam has no target");
    expect(tower(contact).targetId).toBe(targetId);
    const victim = contact.vectoids.find((v) => v.id === targetId);
    if (victim === undefined) throw new Error("target not in the Snapshot");
    expect(victim).toMatchObject({ type: "blueSpinner", wave: 1, maxHp: 550, bounty: 5 });
    expect(Math.hypot(victim.x - 3.5, victim.y - 1.5)).toBeLessThanOrEqual(2.8); // in Range of the Tower centre
    // 22 damage x 40 hits/s = 880 dps, spread over ticks: 550 hp is down by 22 / 3 after the first hit.
    expect(victim.hp).toBeCloseTo(550 - 22 * (40 / TICKS_PER_SECOND), 9);

    const events = stepUntil(run, (_s, e) => e.some((x) => x.type === "killed"), 200);
    const killed = eventsOfType(events, "killed");
    expect(killed).toHaveLength(1);
    expect(killed[0]).toEqual({ type: "killed", tick: killed[0]?.tick, vectoidId: targetId, towerId: 1, bounty: 5 });
    const killTick = killed[0]?.tick ?? Number.NaN;
    // 550 hp / 880 dps = 0.625 s = 75 ticks of contact (towers research 1.1, 1.3).
    const contactTicks = killTick - firstContactTick + 1;
    expect(contactTicks).toBeGreaterThanOrEqual(75);
    expect(contactTicks).toBeLessThanOrEqual(78);

    const s = run.snapshot();
    expect(s.economy.bank).toBe(175 + 5); // economy research 2: Bounty banked
    expect(s.economy.score).toBe(500); // economy research 3: Bounty x 100
    expect(s.wave.alive).toBe(27);
    expect(s.vectoids.find((v) => v.id === targetId)).toBeUndefined();
    // The killing tick still draws its beam; afterwards the laser holds no
    // target and waits 10 frames = 0.25 s before re-scanning (towers research 1.3).
    expect(s.beams).toEqual([{ towerId: 1, targetIds: [targetId], charge: 1 }]);
    expect(tower(s).targetId).toBeNull();
    const idle = stepTicks(run, Math.round(0.25 * TICKS_PER_SECOND) - 1);
    expect(eventsOfType(idle, "killed")).toEqual([]);
    const waiting = run.snapshot();
    expect(waiting.beams).toEqual([]);
    expect(tower(waiting).targetId).toBeNull();
  });

  it("every kill banks the Bounty and scores 100 x Bounty (economy research 3)", () => {
    const run = withGreenLaser1();
    must(run, { type: "sendWave" });
    const events = stepTicks(run, 10 * TICKS_PER_SECOND);
    const kills = eventsOfType(events, "killed");
    expect(kills.length).toBeGreaterThanOrEqual(2);
    for (const k of kills) expect(k).toMatchObject({ towerId: 1, bounty: 5 });
    expect(new Set(kills.map((k) => k.vectoidId)).size).toBe(kills.length);
    const s = run.snapshot();
    expect(s.economy.bank).toBe(175 + 5 * kills.length);
    expect(s.economy.score).toBe(500 * kills.length);
    expect(s.wave.alive).toBe(28 - kills.length);
  });
});

describe("victory with Green Laser 1 and Auto (waves research 1.1)", () => {
  // Every Vectoid has 1 hp so one hit kills; the Send gate is lifted so Auto is never blocked.
  const oneHit = overrideRuleset(original, { startHp: 1, maxAliveToSend: 1000, suffix: "victory" });

  it("two Green Laser 1 by the Entry reach Wave 50 and end in victory with every Life left", () => {
    // One laser alone Leaks nine Yellow Sprinters per Sprinter Wave (45 over the Run, more than
    // 20 Lives): after each kill it waits 10 frames before re-scanning (towers research 1.3), and
    // Sprinters arrive every 0.125 s across the two Lanes. A second $100 laser clears them.
    const run = createRun({ ruleset: oneHit, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: GL1_CELL });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } });
    expect(run.snapshot().economy.bank).toBe(75);
    must(run, { type: "setAuto", enabled: true });
    const events = stepUntilEnded(run, 60_000);
    const ended = eventsOfType(events, "runEnded");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ type: "runEnded", outcome: "victory" });
    const s = run.snapshot();
    expect(s.outcome).toBe("victory");
    expect(s.wave.current).toBe(50);
    expect(s.wave.next).toBeNull();
    expect(s.wave.alive).toBe(0);
    expect(s.economy.lives).toBeGreaterThan(0);
    expect(s.economy.lives).toBe(20); // no Leaks at all
    expect(eventsOfType(events, "leaked")).toEqual([]);
    expect(ended[0]?.score).toBe(s.economy.score);
    // Fifty Waves of 28 Vectoids, every one killed by one of the two lasers.
    const kills = eventsOfType(events, "killed");
    expect(kills).toHaveLength(50 * 28);
    expect(kills.every((k) => k.towerId === 1 || k.towerId === 2)).toBe(true);
    expect(kills.some((k) => k.towerId === 1)).toBe(true);
    expect(kills.some((k) => k.towerId === 2)).toBe(true);
    expect(eventsOfType(events, "waveSent").map((w) => w.wave)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    // Ten Bonus Waves, one Bonus Cell each.
    expect(eventsOfType(events, "bonusPointEarned")).toHaveLength(10);
    expect(s.economy.bonusPoints).toBe(10);
  });
});
