/**
 * M1-09: Green Laser 2 and 3 chaining.
 * Numbers: towers research 1.1 (Green Laser 2: $400, 45 damage; Green Laser
 * 3: $2000, 200 damage; both 40 hits/s with 70 px of Range), 1.3 (GL2 chains
 * once and GL3 twice to a Vectoid within 50 px = 2 Cells of the previous
 * victim, every hop at the full colour-adjusted damage; 10 frames = 0.25 s
 * wait after losing a target), 2.1 (colour multipliers), 3.1 (ties go to the
 * earliest spawned); waves research 1.1 (Wave types, Wave 50 is mixed).
 *
 * Geometry. Switchback's two Lanes run 0.8 Cells apart everywhere, so no
 * Cell sees a single Lane and every Vectoid usually has a neighbour of the
 * other Lane 0.8 Cells away, as far as its own queue-mate. The tests use the
 * first corner, where Lane 1 turns right at row 2.6 while Lane 0 still walks
 * down column 1.6 to row 3.4: a Tower on (0,5) (centre 0.5, 5.5) reaches only
 * Lane 0 there, and once Lane 0's leader has rounded the corner its two
 * queue-mates are strictly nearer than anything in Lane 1. A Lane's queue
 * spawns 0.8 Cells apart (towers research 3.1), so "three Vectoids in a line
 * one Cell apart" is approximated by three consecutive Vectoids of Lane 0.
 * Earlier Waves are Sent at tick 0 and walked 15 s clear of the Entry, as in
 * colour-rule.test.ts.
 */
import { describe, expect, it } from "vitest";
import { createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Ruleset, Run, SelectableMode, SimEvent, Snapshot, TowerKind, TowerSnapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Nothing dies, nothing ends, every Wave Sendable at once, and the Bank affords Green Laser 3. */
const sturdy = overrideRuleset(original, {
  startHp: 100_000,
  startBank: 5000,
  lives: 100_000,
  maxAliveToSend: 100_000,
  suffix: "chain-sturdy",
});

/** One hit kills (every Wave stays at 1 hp under this table), same Bank and gates. */
const oneHit = overrideRuleset(original, {
  startHp: 1,
  startBank: 5000,
  lives: 100_000,
  maxAliveToSend: 100_000,
  suffix: "chain-onehit",
});

/** Outside Lane 0's first corner: reaches Lane 0 from row 2.925 down to column 2.35, and no Cell of Lane 1. */
const CORNER_CELL = { col: 0, row: 5 } as const;
/** Beside the Entry: reaches both Lanes' first Cells. */
const ENTRY_CELL = { col: 3, row: 1 } as const;
/** Above the Lanes' first straight, 10 Cells down Lane 1 from its Entry. */
const DOWNSTREAM_CELL = { col: 12, row: 1 } as const;

const HITS_PER_TICK = 40 / TICKS_PER_SECOND; // towers research 1.1: 40 hits/s
const CHAIN_RADIUS = 2; // towers research 1.3: 50 px
const REACQUIRE_TICKS = Math.round(0.25 * TICKS_PER_SECOND); // towers research 1.3: 10 frames
const QUEUE_SPACING = 0.8; // towers research 3.1: spawned 20 px apart
const VECTOIDS_PER_WAVE = 28;

interface LaserKind {
  readonly kind: TowerKind;
  readonly cost: number;
  readonly damage: number;
  readonly hops: number;
}

// towers research 1.1 and 1.3.
const GREEN_LASER_2: LaserKind = { kind: "greenLaser2", cost: 400, damage: 45, hops: 1 };
const GREEN_LASER_3: LaserKind = { kind: "greenLaser3", cost: 2000, damage: 200, hops: 2 };

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

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

function between(a: VectoidSnapshot, b: VectoidSnapshot): number {
  return distance(a.x, a.y, b.x, b.y);
}

/** Distance from a Tower's centre to a Vectoid, in Cells. */
function distanceFrom(t: TowerSnapshot, v: VectoidSnapshot): number {
  return distance(t.cell.col + 0.5, t.cell.row + 0.5, v.x, v.y);
}

/** Original: only Vectoids inside the 22 x 18 field are targetable (towers research 3.3). */
function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

/** Ids of the on-field Vectoids within the Tower's Range. */
function inRangeOf(s: Snapshot, t: TowerSnapshot): number[] {
  return s.vectoids.filter((v) => onField(v) && distanceFrom(t, v) <= t.range).map((v) => v.id);
}

/** On-field Vectoids other than `exclude`, nearest to `from` first. */
function othersByDistance(s: Snapshot, from: VectoidSnapshot, exclude: readonly number[]): VectoidSnapshot[] {
  return s.vectoids
    .filter((v) => onField(v) && !exclude.includes(v.id))
    .sort((a, b) => between(from, a) - between(from, b));
}

/** The only beam in the Snapshot. */
function theBeam(s: Snapshot): { readonly towerId: number; readonly targetIds: readonly number[]; readonly charge: number } {
  const beam = s.beams[0];
  if (beam === undefined || s.beams.length !== 1) throw new Error(`expected one beam, got ${String(s.beams.length)}`);
  return beam;
}

/** Send Waves 1..wave-1 at tick 0 and walk them `seconds` (24 Cells at 15 s) down the Lanes. */
function runWithEarlierWavesGone(ruleset: Ruleset, wave: number, seconds = 15): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  for (let w = 1; w < wave; w += 1) must(run, { type: "sendWave" });
  stepTicks(run, seconds * TICKS_PER_SECOND);
  return run;
}

/** Hit points lost by every Vectoid between two Snapshots, by id (0 when untouched). */
function hpLost(before: Snapshot, after: Snapshot): Map<number, number> {
  const lost = new Map<number, number>();
  for (const v of before.vectoids) {
    const later = after.vectoids.find((x) => x.id === v.id);
    lost.set(v.id, later === undefined ? v.hp : v.hp - later.hp);
  }
  return lost;
}

/** Lane 0's leader of a Wave; its queue-mates follow with consecutive ids. */
function lane0Leader(wave: number): number {
  return (wave - 1) * VECTOIDS_PER_WAVE + 1;
}

describe("the Cells used", () => {
  it("are buildable", () => {
    for (const cell of [CORNER_CELL, ENTRY_CELL, DOWNSTREAM_CELL]) expect(switchback.isBuildable(cell)).toBe(true);
  });

  it("(0,5) reaches Lane 0 around its first corner and never Lane 1 on the Lanes' first 8 Cells", () => {
    const cx = CORNER_CELL.col + 0.5;
    const cy = CORNER_CELL.row + 0.5;
    const lane0 = switchback.lanes[0];
    const lane1 = switchback.lanes[1];
    if (lane0 === undefined || lane1 === undefined) throw new Error("Switchback has two Lanes");
    const reach = (d: number, lane = lane0): boolean => {
      const p = lane.positionAt(d);
      return distance(cx, cy, p.x, p.y) <= 2.8; // towers research 1.1: 70 px
    };
    expect(reach(3.2)).toBe(false);
    expect(reach(3.4)).toBe(true); // Lane 0 at (1.6, 3.0)
    expect(reach(4.0)).toBe(true); // Lane 0 at (2.0, 3.4), past the corner
    expect(reach(4.5)).toBe(true);
    expect(reach(4.6)).toBe(false);
    for (let d = 0; d <= 8; d += 0.05) expect(reach(d, lane1)).toBe(false);
  });
});

describe("Green Laser 2 and 3 placement (towers research 1.1)", () => {
  it.each([GREEN_LASER_2, GREEN_LASER_3])("$kind costs $$cost, has $damage damage, 40 hits/s, 2.8 Range, Close mode, and no lock", (laser) => {
    const run = createRun({ ruleset: sturdy, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: laser.kind, cell: CORNER_CELL });
    const s = run.snapshot();
    expect(s.economy.bank).toBe(5000 - laser.cost);
    expect(tower(s)).toMatchObject({
      kind: laser.kind,
      damage: laser.damage,
      mode: "close",
      selectableModes: true,
      lockable: false,
      lock: false,
      targetId: null,
    });
    expect(tower(s).range).toBeCloseTo(2.8, 12);
    expect(tower(s).cooldown).toBeCloseTo(1 / 40, 12);
  });

  it("Green Laser 3 is unaffordable on the Original Bank of $275", () => {
    const run = createRun({ ruleset: original, map: switchback, seed: 1 });
    expect(run.apply(at(run, { type: "placeTower", kind: "greenLaser3", cell: CORNER_CELL }))).toEqual({
      ok: false,
      reason: "unaffordable",
    });
  });
});

describe("three Vectoids in a line: the chain along Lane 0 past its first corner (towers research 1.3, 2.1)", () => {
  // Three hundred ticks after a Send, Lane 0's leader is 4.0 Cells down the
  // Lane at (2.0, 3.4), its queue-mates at (1.6, 2.8) and (1.6, 2.0); Lane 1's
  // nearest Vectoids sit at (2.6, 2.6) and (2.4, 2.0), a full Cell or more
  // from each victim against 0.57 and 0.8 for the queue-mates. The laser has
  // held the leader since it came into Range at 3.33 Cells, so the primary is
  // fixed and the hops are unambiguous.
  const TICKS_TO_THE_CORNER = 300;

  const waves = [
    { wave: 1, type: "blueSpinner", multiplier: 1 }, // no affinity with Green: 100%
    { wave: 2, type: "redShredder", multiplier: 0.5 }, // Green's opposite: 50%
    { wave: 4, type: "greenFlyer", multiplier: 1.5 }, // Green's own colour: 150%
  ] as const;

  const cases = [GREEN_LASER_2, GREEN_LASER_3].flatMap((laser) => waves.map((w) => ({ ...laser, ...w })));

  it.each(cases)(
    "$kind on Wave $wave ($type): the first $hops hop(s) of Lane 0's queue each lose damage x 40/120 x $multiplier per tick",
    ({ kind, cost, damage, hops, wave, type, multiplier }) => {
      const run = runWithEarlierWavesGone(sturdy, wave);
      must(run, { type: "sendWave" });
      const bankBefore = run.snapshot().economy.bank; // Interest was paid on this Send when wave > 1
      must(run, { type: "placeTower", kind, cell: CORNER_CELL });
      expect(run.snapshot().economy.bank).toBe(bankBefore - cost);

      stepTicks(run, TICKS_TO_THE_CORNER - 1);
      const before = run.snapshot();
      run.step();
      const after = run.snapshot();

      const leader = lane0Leader(wave);
      const victims = Array.from({ length: 1 + hops }, (_, i) => leader + i);
      expect(tower(after).targetId).toBe(leader);
      expect(after.beams).toEqual([{ towerId: 1, targetIds: victims, charge: 1 }]);

      // The line: consecutive Vectoids of Lane 0's queue, 0.8 Cells apart along the Lane,
      // every hop within 2 Cells of the previous victim, and nearer than anything else.
      const chain = victims.map((id) => vectoid(after, id));
      expect(chain.every((v) => v.lane === 0 && v.type === type && v.wave === wave)).toBe(true);
      expect(chain[0]?.distance).toBeCloseTo(4.0, 6);
      for (let i = 1; i < chain.length; i += 1) {
        const previous = chain[i - 1];
        const hop = chain[i];
        if (previous === undefined || hop === undefined) throw new Error("chain too short");
        expect(previous.distance - hop.distance).toBeCloseTo(QUEUE_SPACING, 9);
        expect(between(previous, hop)).toBeLessThanOrEqual(CHAIN_RADIUS);
        const runnerUp = othersByDistance(after, previous, victims.slice(0, i))[1];
        if (runnerUp === undefined) throw new Error("no runner-up");
        expect(runnerUp.lane).toBe(1);
        expect(between(previous, runnerUp)).toBeGreaterThan(between(previous, hop) + 0.2);
      }
      // Lane 1 is on field beside the corner but never the nearest choice.
      expect(after.vectoids.some((v) => v.lane === 1 && v.wave === wave && onField(v))).toBe(true);
      // Only the primary needs to be in Range: the second Vectoid sits 2.92 Cells
      // from the Tower, beyond 2.8, and is hit through the chain (towers research
      // 1.3 measures hops from the previous victim, not from the Tower).
      expect(distanceFrom(tower(after), vectoid(after, leader))).toBeLessThanOrEqual(2.8);
      expect(distanceFrom(tower(after), vectoid(after, leader + 1))).toBeGreaterThan(2.8);

      // Damage: one tick of beam on every victim at the primary's multiplier, nothing else touched.
      const lost = hpLost(before, after);
      const perTick = damage * HITS_PER_TICK * multiplier;
      for (const id of victims) expect(lost.get(id)).toBeCloseTo(perTick, 9);
      for (const [id, amount] of lost) if (!victims.includes(id)) expect(amount).toBe(0);
      // The next Vectoid of the queue is within 2 Cells of the last victim but the hops are spent.
      const next = vectoid(after, leader + 1 + hops);
      expect(between(vectoid(after, leader + hops), next)).toBeLessThanOrEqual(CHAIN_RADIUS);
      expect(lost.get(next.id)).toBe(0);
    },
  );
});

describe("chain victims take the primary's colour multiplier, not their own (towers research 1.3, 2.1)", () => {
  // Waves 1 (Blue Spinners) and 2 (Red Shredders) Sent on the same tick walk
  // in step: Wave 2's Vectoids coincide exactly with Wave 1's. Close ties go
  // to the earliest spawned (towers research 3.1), so the Blue Spinner is the
  // primary and the Red Shredder on top of it (distance 0) is the hop. Hard
  // picks the Red Shredder instead: Wave 2 has more hit points. Green Laser 3's
  // second hop reaches the next pair of the queue, where Wave 1's Vectoid wins
  // the exact tie again.
  interface MixedCase {
    readonly laser: LaserKind;
    readonly mode: SelectableMode;
    readonly primaryType: "blueSpinner" | "redShredder";
    readonly multiplier: number;
    readonly victims: readonly number[];
  }
  const blue = lane0Leader(1); // id 1
  const red = lane0Leader(2); // id 29
  const cases: readonly MixedCase[] = [
    { laser: GREEN_LASER_2, mode: "close", primaryType: "blueSpinner", multiplier: 1, victims: [blue, red] },
    { laser: GREEN_LASER_2, mode: "hard", primaryType: "redShredder", multiplier: 0.5, victims: [red, blue] },
    { laser: GREEN_LASER_3, mode: "close", primaryType: "blueSpinner", multiplier: 1, victims: [blue, red, blue + 1] },
    { laser: GREEN_LASER_3, mode: "hard", primaryType: "redShredder", multiplier: 0.5, victims: [red, blue, blue + 1] },
  ];

  it.each(cases)(
    "$laser.kind in $mode mode: a $primaryType primary makes every victim lose damage x 40/120 x $multiplier",
    ({ laser, mode, primaryType, multiplier, victims }) => {
      const run = createRun({ ruleset: sturdy, map: switchback, seed: 1 });
      must(run, { type: "sendWave" });
      must(run, { type: "sendWave" });
      must(run, { type: "placeTower", kind: laser.kind, cell: CORNER_CELL });
      must(run, { type: "setTargetingMode", towerId: 1, mode });

      stepTicks(run, 299);
      const before = run.snapshot();
      run.step();
      const after = run.snapshot();

      const blueSpinner = vectoid(after, blue);
      const redShredder = vectoid(after, red);
      expect(blueSpinner).toMatchObject({ type: "blueSpinner", wave: 1, lane: 0, maxHp: 100_000 });
      expect(redShredder).toMatchObject({ type: "redShredder", wave: 2, lane: 0, maxHp: 120_000 }); // waves research 1.2: +hp/5
      expect([redShredder.x, redShredder.y]).toEqual([blueSpinner.x, blueSpinner.y]);
      expect(vectoid(after, blue + 1).x).toBe(vectoid(after, red + 1).x);
      expect(vectoid(after, blue + 1).y).toBe(vectoid(after, red + 1).y);

      const primary = victims[0];
      if (primary === undefined) throw new Error("no primary");
      expect(vectoid(after, primary).type).toBe(primaryType);
      expect(tower(after).targetId).toBe(primary);
      expect(after.beams).toEqual([{ towerId: 1, targetIds: victims, charge: 1 }]);

      const lost = hpLost(before, after);
      const perTick = laser.damage * HITS_PER_TICK * multiplier;
      for (const id of victims) expect(lost.get(id)).toBeCloseTo(perTick, 9);
      for (const [id, amount] of lost) if (!victims.includes(id)) expect(amount).toBe(0);
      // Spelled out: the Red Shredder under a Blue primary takes 100%, not its own 50%,
      // and the Blue Spinner under a Red primary takes 50%, not its own 100%.
      const ownMultiplier = { blueSpinner: 1, redShredder: 0.5 } as const;
      const other = primaryType === "blueSpinner" ? red : blue;
      const otherType = primaryType === "blueSpinner" ? "redShredder" : "blueSpinner";
      expect(lost.get(other)).toBeCloseTo(laser.damage * HITS_PER_TICK * multiplier, 9);
      expect(lost.get(other)).not.toBeCloseTo(laser.damage * HITS_PER_TICK * ownMultiplier[otherType], 9);
    },
  );
});

describe("no hop to a Vectoid more than two Cells from the previous victim (towers research 1.3)", () => {
  // Every Wave but the last walks in 0.8-Cell files, so a gap wider than two
  // Cells needs Wave 50: its Lane 1 opens with five Yellow Sprinters (waves
  // research 1.1: mixed order, entries 15..19) that run at twice the speed
  // and leave the rest of the Wave far behind. A Green Laser 3 ten Cells down
  // Lane 1 meets that file alone (the earlier Waves are walked 20 s so even
  // their tails are past its Range). Under 1 hp its first contact kills the
  // front three; the fourth and fifth arrive 90 ticks later as a file of two,
  // and the beam stops at those two with a hop to spare, although more than a
  // thousand Vectoids are on field: none is within two Cells of the fifth.
  const SPRINTERS = [1387, 1388, 1389, 1390, 1391] as const; // Wave 50, Lane 1's first five

  it("Green Laser 3 on Wave 50's Sprinter file: three victims from a file of five, two from the file of two left behind", () => {
    const run = runWithEarlierWavesGone(oneHit, 50, 20);
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser3", cell: DOWNSTREAM_CELL });
    for (const id of SPRINTERS) expect(vectoid(run.snapshot(), id)).toMatchObject({ type: "yellowSprinter", wave: 50, lane: 1, hp: 1 });
    expect(vectoid(run.snapshot(), 1392).type).toBe("bigPurpleBox"); // Lane 1's sixth, at the slow pace
    expect(vectoid(run.snapshot(), 1373).type).toBe("redShredder"); // Lane 0's leader, at the slow pace

    // First contact: the file's leader and the two behind it, all killed on the spot.
    const firstEvents = stepUntil(run, (s) => s.beams.length > 0, 600);
    const first = run.snapshot();
    const firstTick = first.tick - 1;
    expect(theBeam(first).targetIds).toEqual([1387, 1388, 1389]);
    expect(eventsOfType(firstEvents, "killed").map((k) => k.vectoidId)).toEqual([1387, 1388, 1389]);
    expect(first.vectoids.filter(onField).length).toBeGreaterThan(1000);

    // The fourth Sprinter reaches the Range 2.4 Cells = 90 ticks after the leader did.
    let before = first;
    let contact: Snapshot | null = null;
    let contactEvents: readonly SimEvent[] = firstEvents;
    for (let i = 0; i < 200 && contact === null; i += 1) {
      const previous = run.snapshot();
      const events = run.step();
      const s = run.snapshot();
      if (s.beams.length > 0) {
        before = previous;
        contact = s;
        contactEvents = events;
      } else {
        expect(eventsOfType(events, "killed")).toEqual([]);
      }
    }
    if (contact === null) throw new Error("the fourth Sprinter never came into Range");
    expect(contact.tick - 1 - firstTick).toBeGreaterThan(REACQUIRE_TICKS);
    expect(theBeam(contact).targetIds).toEqual([1390, 1391]);
    expect(eventsOfType(contactEvents, "killed").map((k) => k.vectoidId)).toEqual([1390, 1391]);

    // The tick before: a file of two, 0.8 Cells apart, with every other Vectoid on field
    // well beyond two Cells of either (Vectoids move at most 0.027 Cells a tick).
    const fourth = vectoid(before, 1390);
    const fifth = vectoid(before, 1391);
    expect(between(fourth, fifth)).toBeCloseTo(QUEUE_SPACING, 6);
    expect(distanceFrom(tower(before), fifth)).toBeGreaterThan(2.8); // only the primary is in Range
    const others = othersByDistance(before, fifth, [1390, 1391]);
    expect(others.length).toBeGreaterThan(1000);
    const nearest = others[0];
    if (nearest === undefined) throw new Error("no other Vectoid");
    expect(between(fifth, nearest)).toBeGreaterThan(CHAIN_RADIUS + 0.5);
    expect(between(fourth, nearest)).toBeGreaterThan(CHAIN_RADIUS + 0.5);
    // Nothing else was hurt: only the two victims are gone.
    const gone = before.vectoids.filter((v) => !contact.vectoids.some((c) => c.id === v.id)).map((v) => v.id);
    expect(gone).toEqual([1390, 1391]);
    for (const v of others) expect(vectoid(contact, v.id).hp).toBe(v.hp);
  });
});

describe("after its target dies a Green Laser waits 0.25 s before re-scanning (towers research 1.3)", () => {
  // Waves 1 and 2 Sent together on the same tick under 1 hp: each pair on
  // field is really two coincident pairs. On contact Green Laser 2 kills the
  // Close primary and the Vectoid on top of it, leaving the other Lane's pair
  // alive, in Range, and untouched for the whole wait; the laser takes them
  // on the 31st tick, and the next pair of the queue 31 ticks after that.
  it("Green Laser 2 kills two per contact and resumes on the 31st tick after each kill, never earlier", () => {
    const run = createRun({ ruleset: oneHit, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "greenLaser2", cell: ENTRY_CELL });

    // Lane 1's leaders (Wave 1 id 15, Wave 2 id 43) are nearer to (3.5, 1.5) than Lane 0's (1 and 29).
    const expectedVictims = [
      [15, 43],
      [1, 29],
      [16, 44],
      [2, 30],
      [17, 45],
      [3, 31],
    ];
    let previousKillTick: number | null = null;
    for (const [i, victims] of expectedVictims.entries()) {
      const events = stepUntil(run, (s) => s.beams.length > 0, 600);
      const contact = run.snapshot();
      const killTick = contact.tick - 1;
      expect(theBeam(contact).targetIds).toEqual(victims);
      expect(eventsOfType(events, "killed").map((k) => [k.vectoidId, k.towerId, k.tick])).toEqual(
        victims.map((id) => [id, 1, killTick]),
      );
      expect(contact.vectoids.some((v) => victims.includes(v.id))).toBe(false);
      expect(tower(contact).targetId).toBeNull();
      if (previousKillTick !== null) expect(killTick - previousKillTick).toBe(REACQUIRE_TICKS + 1);
      previousKillTick = killTick;

      // Thirty idle ticks: no beam, no target, no kill.
      const next = expectedVictims[i + 1];
      for (let idle = 1; idle <= REACQUIRE_TICKS; idle += 1) {
        expect(eventsOfType(run.step(), "killed")).toEqual([]);
        const waiting = run.snapshot();
        expect(waiting.beams).toEqual([]);
        expect(tower(waiting).targetId).toBeNull();
        // On the first cycle the other pair stands in Range through the whole wait, untouched.
        if (i === 0 && next !== undefined) {
          expect(inRangeOf(waiting, tower(waiting))).toEqual(next);
          for (const id of next) expect(vectoid(waiting, id).hp).toBe(1);
        }
      }
      // The next victims are on field and in Range on the last idle tick, still not taken.
      if (next !== undefined) {
        const lastIdle = run.snapshot();
        for (const id of next) expect(inRangeOf(lastIdle, tower(lastIdle))).toContain(id);
      }
    }
  });
});
