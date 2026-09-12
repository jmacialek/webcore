/**
 * M1-07: Targeting Modes and Target Lock, proved with the Red Refractor.
 * Numbers: towers research 1.3 (Refractor: 1 shot / 10 frames, splash to
 * 50 px falling linearly from 100% to 50%), 3.1 (Close / Hard / Weak, ties
 * to the earliest spawned), 3.2 (Target Lock); v1.2 verification 1.1-1.4
 * (defaults per kind, which kinds expose the mode and lock controls).
 *
 * Geometry used throughout: on Switchback, Lane 0 walks down x = 1.6 and
 * Lane 1 down x = 2.4, 0.8 Cells apart, so a Tower on (3,0) (centre 3.5, 0.5)
 * is nearer to Lane 1. Vectoids of a Lane are 0.8 Cells apart and walk
 * 1.6 Cells/s, so a new pair comes on field every 60 ticks: the leaders
 * (1 and 15) at tick 30, then (2, 16) at 90, (3, 17) at 150, and so on.
 */
import { describe, expect, it } from "vitest";
import { classic, createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { Run, SelectableMode, Snapshot, TargetingMode, TowerKind, TowerSnapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { at, eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Hit points raised so nothing dies mid-scenario; Bank raised to afford every kind. */
const sturdy = overrideRuleset(original, {
  startHp: 100_000,
  startBank: 100_000,
  lives: 100_000,
  maxAliveToSend: 100_000,
  suffix: "targeting",
});

const REFRACTOR_DAMAGE = 110; // towers research 1.1
const REFRACTOR_PERIOD_TICKS = TICKS_PER_SECOND / 4; // towers research 1.3: 1 shot / 10 frames = 0.25 s
const SPLASH_RADIUS = 2; // towers research 1.3: 50 px
const SPLASH_EDGE_FRACTION = 0.5; // towers research 1.3

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

/** Distance from a Tower's centre to a Vectoid, in Cells. */
function distanceFrom(t: TowerSnapshot, v: VectoidSnapshot): number {
  return distance(t.cell.col + 0.5, t.cell.row + 0.5, v.x, v.y);
}

function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

/** Ids of the on-field Vectoids within the Tower's Range (towers research 3.3). */
function inRangeOf(s: Snapshot, t: TowerSnapshot): number[] {
  return s.vectoids.filter((v) => onField(v) && distanceFrom(t, v) <= t.range).map((v) => v.id);
}

/** Wave 1 Sent and a Red Refractor on (3,0), with an optional mode set before the first tick. */
function refractorRun(mode?: SelectableMode, ruleset = sturdy): Run {
  const run = createRun({ ruleset, map: switchback, seed: 1 });
  must(run, { type: "sendWave" });
  must(run, { type: "placeTower", kind: "redRefractor", cell: { col: 3, row: 0 } });
  if (mode !== undefined) must(run, { type: "setTargetingMode", towerId: 1, mode });
  return run;
}

function targetOf(run: Run, towerId = 1): number | null {
  return tower(run.snapshot(), towerId).targetId;
}

describe("default Targeting Mode and Target Lock per kind (towers research 3.1, verification 1.1)", () => {
  interface Defaults {
    readonly mode: TargetingMode;
    readonly selectableModes: boolean;
    readonly lockable: boolean;
  }
  const selectable = (mode: SelectableMode, lockable: boolean): Defaults => ({ mode, selectableModes: true, lockable });
  const fixed = (mode: "random" | "fastest"): Defaults => ({ mode, selectableModes: false, lockable: false });

  type DefaultsTable = Readonly<Partial<Record<TowerKind, Defaults>>>;
  const v12: DefaultsTable = {
    greenLaser1: selectable("close", false),
    greenLaser2: selectable("close", false),
    greenLaser3: selectable("close", false),
    redRefractor: selectable("close", true),
    littleRedSpammer: fixed("random"),
    redRockets: selectable("hard", true),
    purplePower1: selectable("hard", true),
    purplePower2: selectable("hard", true),
    purplePower3: selectable("hard", true),
    blueRays1: fixed("fastest"),
    blueRays2: fixed("fastest"),
  };
  // CONTEXT.md: Blue Frost Rockets has a player-selectable Targeting Mode; it locks like the other rocket Tower.
  const withFrost: DefaultsTable = { ...v12, blueFrostRockets: selectable("close", true) };

  // Some kinds are still behaviour stubs that throw on tick, so these Runs never step:
  // every Tower is placed on row 0 and read straight from the Snapshot.
  it.each([
    ["Original", original, v12],
    ["Classic", classic, withFrost],
  ] as const)("under %s every kind starts in its research mode, with lock on exactly when it is lockable", (_name, base, expected) => {
    const ruleset = overrideRuleset(base, { startBank: 100_000, suffix: "defaults" });
    const run = createRun({ ruleset, map: switchback, seed: 1 });
    const kinds = Object.keys(expected) as TowerKind[];
    kinds.forEach((kind, i) => {
      const cell = { col: 3 + i, row: 0 };
      expect(switchback.isBuildable(cell)).toBe(true);
      must(run, { type: "placeTower", kind, cell });
    });
    const s = run.snapshot();
    expect(s.towers).toHaveLength(kinds.length);
    for (const t of s.towers) {
      const want = expected[t.kind];
      if (want === undefined) throw new Error(`no expectation for ${t.kind}`);
      expect({ kind: t.kind, mode: t.mode, selectableModes: t.selectableModes, lockable: t.lockable, lock: t.lock }).toEqual({
        kind: t.kind,
        mode: want.mode,
        selectableModes: want.selectableModes,
        lockable: want.lockable,
        lock: want.lockable, // verification 1.1: default ON for every Tower that has it
      });
      expect(t.targetId).toBeNull();
    }
  });
});

describe("Close, Hard, and Weak with Vectoids at distinct distances and hit points (towers research 3.1)", () => {
  /**
   * The Refractor's own first four shots (ticks 30, 60, 90, 120: primary
   * 15, the nearer Lane 1 leader, with splash on 1, 2, 16) spread the hit
   * points, and by tick 121 the followers have walked nearer to (3.5, 0.5)
   * than the leaders. Four Vectoids in Range, all different in both keys.
   */
  function spread(): Run {
    const run = refractorRun();
    stepTicks(run, 121);
    return run;
  }

  it("at tick 121 the four Vectoids in Range differ pairwise in distance and in hit points", () => {
    const s = spread().snapshot();
    const t = tower(s, 1);
    expect(inRangeOf(s, t)).toEqual([1, 2, 15, 16]);
    const byDistance = [1, 2, 15, 16].sort((a, b) => distanceFrom(t, vectoid(s, a)) - distanceFrom(t, vectoid(s, b)));
    expect(byDistance).toEqual([16, 15, 2, 1]);
    const byHp = [1, 2, 15, 16].sort((a, b) => vectoid(s, a).hp - vectoid(s, b).hp);
    expect(byHp).toEqual([15, 1, 16, 2]);
    // Primary 110 x 4; 88 = 80% at 0.8 Cells; 78.89 = 100% - 50% x 1.131 / 2 at the diagonal 1.131 Cells.
    expect(vectoid(s, 15).hp).toBeCloseTo(100_000 - 4 * 110, 9);
    expect(vectoid(s, 1).hp).toBeCloseTo(100_000 - 4 * 88, 9);
    expect(vectoid(s, 16).hp).toBeCloseTo(100_000 - 2 * 88, 9);
    expect(vectoid(s, 2).hp).toBeCloseTo(100_000 - 2 * REFRACTOR_DAMAGE * (1 - SPLASH_EDGE_FRACTION * (Math.sqrt(0.8 * 0.8 + 0.8 * 0.8) / SPLASH_RADIUS)), 9);
  });

  /**
   * Set the mode at tick 121 (which drops the held target), wait out the
   * cooldown, and read the target the shot at tick 150 picked. Vectoids 3
   * and 17 come on field that very tick at full hit points.
   */
  function pickAt150(mode: SelectableMode): { readonly picked: number | null; readonly before: Snapshot; readonly after: Snapshot } {
    const run = spread();
    must(run, { type: "setTargetingMode", towerId: 1, mode });
    expect(targetOf(run)).toBeNull();
    stepTicks(run, REFRACTOR_PERIOD_TICKS - 1);
    const before = run.snapshot();
    expect(before.tick).toBe(150);
    expect(targetOf(run)).toBeNull(); // still cooling down: nothing picked yet
    run.step();
    const after = run.snapshot();
    return { picked: targetOf(run), before, after };
  }

  it("Close picks the nearest Vectoid to the Tower centre", () => {
    const { picked, after } = pickAt150("close");
    const t = tower(after, 1);
    const candidates = inRangeOf(after, t);
    expect(candidates).toEqual([1, 2, 3, 15, 16, 17]);
    const nearest = candidates.reduce((best, id) => (distanceFrom(t, vectoid(after, id)) < distanceFrom(t, vectoid(after, best)) ? id : best));
    expect(nearest).toBe(16);
    expect(picked).toBe(16);
  });

  it("Weak picks the lowest current hit points", () => {
    const { picked, before } = pickAt150("weak");
    const candidates = inRangeOf(before, tower(before, 1));
    const weakest = candidates.reduce((best, id) => (vectoid(before, id).hp < vectoid(before, best).hp ? id : best));
    expect(weakest).toBe(15);
    expect(picked).toBe(15);
  });

  it("Hard picks the highest current hit points, and a tie goes to the earliest spawned even though the other is nearer", () => {
    const { picked, before, after } = pickAt150("hard");
    // 3 and 17 both entered untouched this tick; 17 is nearer, 3 spawned first.
    expect(vectoid(before, 3).hp).toBe(100_000);
    expect(vectoid(before, 17).hp).toBe(100_000);
    const t = tower(after, 1);
    expect(distanceFrom(t, vectoid(after, 17))).toBeLessThan(distanceFrom(t, vectoid(after, 3)));
    for (const id of [1, 2, 15, 16]) expect(vectoid(before, id).hp).toBeLessThan(100_000);
    expect(picked).toBe(3);
  });

  it("before any damage the two leaders tie: Hard and Weak take the Lane 0 leader (spawned first), Close the nearer Lane 1 leader", () => {
    for (const [mode, want] of [
      ["close", 15],
      ["hard", 1],
      ["weak", 1],
    ] as const) {
      const run = refractorRun(mode);
      stepTicks(run, 30);
      expect(run.snapshot().vectoids.every((v) => v.hp === 100_000)).toBe(true);
      expect(targetOf(run)).toBeNull();
      run.step(); // tick 30: the leaders come on field and the first shot picks between them
      const s = run.snapshot();
      expect(s.vectoids.filter(onField).map((v) => v.id)).toEqual([1, 15]);
      const t = tower(s, 1);
      expect(distanceFrom(t, vectoid(s, 15))).toBeLessThan(distanceFrom(t, vectoid(s, 1)));
      expect(targetOf(run)).toBe(want);
    }
  });
});

describe("Target Lock on the Red Refractor (towers research 3.2, verification 1.2 and 1.3)", () => {
  it("lock on (the default) holds the target while healthier Vectoids enter Range, until it leaves Range", () => {
    const run = refractorRun("hard");
    expect(tower(run.snapshot(), 1).lock).toBe(true);
    stepTicks(run, 31);
    expect(targetOf(run)).toBe(1);
    // After the first shot 15 (splash 88) is healthier than 1 (primary 110).
    expect(vectoid(run.snapshot(), 15).hp).toBeGreaterThan(vectoid(run.snapshot(), 1).hp);
    stepTicks(run, 30);
    expect(targetOf(run)).toBe(1);
    // At tick 90 Vectoids 2 and 16 come on field untouched (that tick's shot only splashes them); still held.
    stepTicks(run, 30);
    expect(inRangeOf(run.snapshot(), tower(run.snapshot(), 1))).toEqual([1, 2, 15, 16]);
    expect(vectoid(run.snapshot(), 2).hp).toBeGreaterThan(vectoid(run.snapshot(), 15).hp);
    expect(vectoid(run.snapshot(), 16).hp).toBeGreaterThan(vectoid(run.snapshot(), 15).hp);
    expect(targetOf(run)).toBe(1);
    stepTicks(run, 30);
    expect(targetOf(run)).toBe(1);
    // Held until 1 walks out of Range (past y = 3.07 on x = 1.6), then re-picked by Hard.
    stepUntil(run, (s) => tower(s, 1).targetId !== 1, 400);
    const s = run.snapshot();
    expect(distanceFrom(tower(s, 1), vectoid(s, 1))).toBeGreaterThan(tower(s, 1).range);
    expect(inRangeOf(s, tower(s, 1))).not.toContain(1);
    expect(targetOf(run)).toBe(4); // 4 and 18 tie at full hit points; 4 spawned first
  });

  it("lock off re-selects before every shot: Hard switches to the now-healthier Vectoid on the next shot", () => {
    const run = refractorRun("hard");
    stepTicks(run, 31);
    expect(targetOf(run)).toBe(1);
    must(run, { type: "setTargetLock", towerId: 1, lock: false });
    // verification 1.2: toggling is free and does not clear the current target.
    expect(tower(run.snapshot(), 1).lock).toBe(false);
    expect(targetOf(run)).toBe(1);
    stepTicks(run, REFRACTOR_PERIOD_TICKS - 1);
    expect(targetOf(run)).toBe(1); // nothing re-picked between shots
    run.step(); // the shot at tick 60
    expect(targetOf(run)).toBe(15);
    stepTicks(run, REFRACTOR_PERIOD_TICKS); // the shot at tick 90: 2 and 16 just entered at full hit points
    expect(targetOf(run)).toBe(2);
  });

  it("setTargetingMode drops the held target at once so the new mode applies on the next shot; setTargetLock does not", () => {
    const run = refractorRun("hard");
    stepTicks(run, 31);
    expect(targetOf(run)).toBe(1);
    must(run, { type: "setTargetLock", towerId: 1, lock: true });
    expect(targetOf(run)).toBe(1);
    must(run, { type: "setTargetingMode", towerId: 1, mode: "close" });
    expect(targetOf(run)).toBeNull();
    expect(tower(run.snapshot(), 1).mode).toBe("close");
    stepTicks(run, REFRACTOR_PERIOD_TICKS);
    expect(targetOf(run)).toBe(15); // nearest, no longer the held 1
  });

  it("lock on holds the target until it dies (Original hit points: five shots kill a 550 hp Blue Spinner)", () => {
    const run = refractorRun("hard", original);
    const events = stepTicks(run, 5 * REFRACTOR_PERIOD_TICKS + 1);
    const kills = eventsOfType(events, "killed");
    expect(kills).toEqual([{ type: "killed", tick: 150, vectoidId: 1, towerId: 1, bounty: 5 }]);
    expect(targetOf(run)).toBeNull();
    stepTicks(run, REFRACTOR_PERIOD_TICKS);
    expect(targetOf(run)).not.toBeNull();
    expect(targetOf(run)).not.toBe(1);
  });
});

describe("Red Refractor splash (towers research 1.3)", () => {
  it("is exposed in the Snapshot as $200, 110 damage, Range 3.2, 0.25 s cooldown (towers research 1.1)", () => {
    const run = refractorRun();
    const t = tower(run.snapshot(), 1);
    expect(t).toMatchObject({ kind: "redRefractor", damage: 110, range: 3.2, cooldown: 0.25, spend: 200 });
  });

  /**
   * A Refractor on (0,5) first reaches Lane 0 when the leader is 2.9 Cells
   * along, by which time the next three are on field behind it at 0.8, 1.6
   * and 2.4 Cells. Lane 1 is only reached by the splash, never by Range.
   */
  it("primary takes 100%, 80% at 0.8 Cells, 60% at 1.6, nothing at 2.4, and every victim follows 1 - 0.5 x d / 2", () => {
    const run = createRun({ ruleset: sturdy, map: switchback, seed: 1 });
    must(run, { type: "sendWave" });
    must(run, { type: "placeTower", kind: "redRefractor", cell: { col: 0, row: 5 } });
    let before = run.snapshot();
    stepUntil(
      run,
      (s) => {
        const hit = s.vectoids.some((v) => v.hp !== v.maxHp);
        if (!hit) before = s;
        return hit;
      },
      600,
    );
    const after = run.snapshot();
    const firstShotTick = before.tick;
    expect(targetOf(run)).toBe(1);
    expect(inRangeOf(after, tower(after, 1))).toEqual([1]);
    const lost = (id: number): number => vectoid(before, id).hp - vectoid(after, id).hp;
    const primary = vectoid(after, 1);
    const distanceToPrimary = (id: number): number => distance(primary.x, primary.y, vectoid(after, id).x, vectoid(after, id).y);
    // Lane 0 behind the leader.
    expect(distanceToPrimary(2)).toBeCloseTo(0.8, 9);
    expect(distanceToPrimary(3)).toBeCloseTo(1.6, 9);
    expect(distanceToPrimary(4)).toBeCloseTo(2.4, 9);
    expect(lost(1)).toBeCloseTo(110, 9);
    expect(lost(2)).toBeCloseTo(88, 9);
    expect(lost(3)).toBeCloseTo(66, 9);
    expect(lost(4)).toBe(0);
    // Lane 1 alongside: 0.8 across, then the diagonals 1.131 and 1.789, then 2.53 (beyond 2 Cells).
    expect(lost(15)).toBeCloseTo(88, 9);
    expect(lost(16)).toBeCloseTo(110 * (1 - 0.5 * (Math.sqrt(0.8 * 0.8 + 0.8 * 0.8) / 2)), 9);
    expect(lost(17)).toBeCloseTo(110 * (1 - 0.5 * (Math.sqrt(0.8 * 0.8 + 1.6 * 1.6) / 2)), 9);
    expect(distanceToPrimary(18)).toBeGreaterThan(SPLASH_RADIUS);
    expect(lost(18)).toBe(0);
    // Every Vectoid, on field or queued, matches the falloff; the queue is off-Grid and untouched.
    for (const v of after.vectoids) {
      const d = distanceToPrimary(v.id);
      const want = onField(v) && d <= SPLASH_RADIUS ? REFRACTOR_DAMAGE * (1 - (1 - SPLASH_EDGE_FRACTION) * (d / SPLASH_RADIUS)) : 0;
      expect(lost(v.id)).toBeCloseTo(want, 9);
    }
    // Four shots a second: the next shot lands exactly 30 ticks later, on the held primary.
    stepTicks(run, REFRACTOR_PERIOD_TICKS - 1);
    expect(vectoid(run.snapshot(), 1).hp).toBe(primary.hp);
    run.step();
    expect(run.snapshot().tick).toBe(firstShotTick + REFRACTOR_PERIOD_TICKS + 1);
    expect(vectoid(run.snapshot(), 1).hp).toBeCloseTo(primary.hp - 110, 9);
  });
});

describe("mode and lock Commands on ineligible Towers are rejected with no state change (verification 1.1 and 1.4)", () => {
  function panel(): Run {
    const run = createRun({ ruleset: sturdy, map: switchback, seed: 1 });
    must(run, { type: "placeTower", kind: "greenLaser1", cell: { col: 0, row: 0 } }); // 1
    must(run, { type: "placeTower", kind: "littleRedSpammer", cell: { col: 3, row: 0 } }); // 2
    must(run, { type: "placeTower", kind: "blueRays1", cell: { col: 4, row: 0 } }); // 3
    must(run, { type: "placeTower", kind: "blueRays2", cell: { col: 5, row: 0 } }); // 4
    must(run, { type: "placeTower", kind: "redRefractor", cell: { col: 6, row: 0 } }); // 5
    return run;
  }

  it("setTargetingMode is rejected with modeNotSelectable on the Spammer (Random) and both Blue Rays (Fastest)", () => {
    const run = panel();
    const before = run.snapshot();
    for (const [towerId, mode] of [
      [2, "random"],
      [3, "fastest"],
      [4, "fastest"],
    ] as const) {
      expect(tower(before, towerId)).toMatchObject({ mode, selectableModes: false });
      for (const wanted of ["close", "hard", "weak"] as const) {
        expect(run.apply(at(run, { type: "setTargetingMode", towerId, mode: wanted }))).toEqual({ ok: false, reason: "modeNotSelectable" });
      }
    }
    expect(run.snapshot()).toEqual(before);
    // The rejected Commands stay in the Command Log.
    expect(run.log().filter((e) => !e.result.ok)).toHaveLength(9);
  });

  it("setTargetLock is rejected with notLockable on Green Laser 1, the Spammer, and Blue Rays 1", () => {
    const run = panel();
    const before = run.snapshot();
    for (const towerId of [1, 2, 3] as const) {
      expect(tower(before, towerId)).toMatchObject({ lockable: false, lock: false });
      expect(run.apply(at(run, { type: "setTargetLock", towerId, lock: true }))).toEqual({ ok: false, reason: "notLockable" });
      expect(run.apply(at(run, { type: "setTargetLock", towerId, lock: false }))).toEqual({ ok: false, reason: "notLockable" });
    }
    expect(run.snapshot()).toEqual(before);
  });

  it("the same Commands are accepted on the Refractor, and a missing Tower id is noSuchTower", () => {
    const run = panel();
    must(run, { type: "setTargetingMode", towerId: 5, mode: "weak" });
    must(run, { type: "setTargetLock", towerId: 5, lock: false });
    expect(tower(run.snapshot(), 5)).toMatchObject({ mode: "weak", lock: false, lockable: true, selectableModes: true });
    expect(run.apply(at(run, { type: "setTargetingMode", towerId: 99, mode: "weak" }))).toEqual({ ok: false, reason: "noSuchTower" });
    expect(run.apply(at(run, { type: "setTargetLock", towerId: 99, lock: true }))).toEqual({ ok: false, reason: "noSuchTower" });
  });

  it("Green Lasers accept a mode but never a lock: the Snapshot shows selectableModes true and lockable false", () => {
    const run = panel();
    must(run, { type: "setTargetingMode", towerId: 1, mode: "hard" });
    expect(tower(run.snapshot(), 1)).toMatchObject({ kind: "greenLaser1", mode: "hard", selectableModes: true, lockable: false, lock: false });
  });
});
