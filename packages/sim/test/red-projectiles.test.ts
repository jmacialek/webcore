/**
 * M1-10: Little Red Spammer and Red Rockets projectiles.
 * Numbers: towers research 1.1 (Spammer $800, 600 dmg, Range 90 px = 3.6;
 * Red Rockets $2500, 30000 dmg, Range 150 px = 6.0), 1.3 (Spammer: one
 * rocket every 4 frames at a uniformly random Vectoid in Range, launched
 * from a random point on the Tower, speed 2 -> 4 px/frame, self-destructs
 * if its target dies; Red Rockets: one homing rocket every 45 frames, speed
 * 0 -> 3 px/frame at +0.1 px/frame^2, retargets the nearest on-screen
 * Vectoid if its target dies, explodes harmlessly if none remain), 2.1
 * (colour rule), 3.1 (Hard default, Random fixed), 3.2 (Target Lock); spec
 * "Units and time" (Spammer 10 rockets/s at 3.2 -> 6.4 Cells/s, Red Rockets
 * one per 1.125 s at 0 -> 4.8 Cells/s, both accelerating 6.4 Cells/s^2);
 * spec "Determinism" (the seeded generator's only consumers are the
 * Spammer's target choice and its rocket spawn offset).
 *
 * Geometry: on Switchback Lane 0 walks down x = 1.6 and Lane 1 down x = 2.4;
 * the leaders (1 and 15) come on field at tick 30 and a new pair every 60
 * ticks. A Tower on (3,0) reaches both Lanes at once. Red Rockets on (6,0)
 * (centre 6.5, 0.5) is 4.9 Cells from Lane 0, farther than a rocket flies in
 * one 135-tick cooldown, so two of its rockets are in flight at a time.
 */
import { describe, expect, it } from "vitest";
import { classic, createRun, original, switchback, TICKS_PER_SECOND } from "../src/index.js";
import type { ProjectileSnapshot, Ruleset, Run, SimEvent, Snapshot, TowerSnapshot, VectoidSnapshot } from "../src/index.js";
import { overrideRuleset } from "./helpers/fixtures.js";
import { eventsOfType, must, stepTicks, stepUntil } from "./helpers/run.js";

/** Bank raised to afford both Towers ($800 + $2500 = $3300) and a Green Laser 1. */
const rich = overrideRuleset(original, { startBank: 10_000, suffix: "red-rich" });
/** As `rich`, with hit points raised so nothing dies and the Send gate lifted. */
const sturdy = overrideRuleset(original, { startBank: 10_000, startHp: 100_000, lives: 100_000, maxAliveToSend: 100_000, suffix: "red-sturdy" });
/** As `rich`, with every Vectoid at 1 hp so any hit kills. */
const oneHp = overrideRuleset(original, { startBank: 10_000, startHp: 1, lives: 100_000, suffix: "red-one-hp" });

const SPAMMER_DAMAGE = 600; // towers research 1.1 (Corrections: v1.2 is 600)
const SPAMMER_RANGE = 3.6; // towers research 1.1: 90 px
const SPAMMER_PERIOD_TICKS = TICKS_PER_SECOND / 10; // spec Units and time: 10 rockets/s = 12 ticks
const SPAM_ROCKET_SPEED_MIN = 3.2; // spec Units and time: 2 px/frame
const SPAM_ROCKET_SPEED_MAX = 6.4; // spec Units and time: 4 px/frame
const ROCKETS_DAMAGE = 30_000; // towers research 1.1
const ROCKETS_RANGE = 6; // towers research 1.1: 150 px
const ROCKETS_PERIOD_TICKS = 135; // spec Units and time: 45 frames = 1.125 s
const HOMING_ROCKET_SPEED_MAX = 4.8; // spec Units and time: 3 px/frame
const ROCKET_ACCELERATION = 6.4; // towers research 1.3: 0.1 px/frame^2 = 6.4 Cells/s^2
const ROCKET_ACCELERATION_PER_TICK = ROCKET_ACCELERATION / TICKS_PER_SECOND;
const WAVE_1_HP = 550; // waves research 1.2 (Easy)
const WAVE_1_BOUNTY = 5;
const GREEN_LASER_1_PER_TICK = (22 * 40) / TICKS_PER_SECOND; // towers research 1.1: 880 dps

const SPAMMER_CELL = { col: 3, row: 0 } as const;
/** Only Lane 1 (x = 2.4, 3.1 Cells away) is within 3.6 of (5.5, 0.5): long enough for a rocket to reach top speed. */
const FAR_SPAMMER_CELL = { col: 5, row: 0 } as const;
const ROCKETS_CELL = { col: 6, row: 0 } as const;
const LASER_CELL = { col: 0, row: 0 } as const;
const LEADERS_ENTER_TICK = 30;

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

function projectile(s: Snapshot, id: number): ProjectileSnapshot {
  const p = s.projectiles.find((x) => x.id === id);
  if (p === undefined) throw new Error(`no projectile ${String(id)} in the Snapshot`);
  return p;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

function onField(v: VectoidSnapshot): boolean {
  return v.x > 0 && v.x < 22 && v.y > 0 && v.y < 18;
}

/** Ids of the on-field Vectoids within the Tower's Range (towers research 3.3). */
function inRangeOf(s: Snapshot, t: TowerSnapshot): number[] {
  return s.vectoids.filter((v) => onField(v) && distance(t.cell.col + 0.5, t.cell.row + 0.5, v.x, v.y) <= t.range).map((v) => v.id);
}

/** The on-field Vectoid nearest to a point, ties to the earliest spawned. */
function nearestTo(s: Snapshot, x: number, y: number): number | null {
  let best: VectoidSnapshot | null = null;
  for (const v of s.vectoids) {
    if (!onField(v)) continue;
    if (best === null || distance(x, y, v.x, v.y) < distance(x, y, best.x, best.y)) best = v;
  }
  return best === null ? null : best.id;
}

/** Wave 1 Sent at tick 0 with the given Towers placed in order. */
function runWith(ruleset: Ruleset, towers: readonly { readonly kind: "littleRedSpammer" | "redRockets" | "greenLaser1" | "blueFrostRockets"; readonly cell: { readonly col: number; readonly row: number } }[], seed = 1): Run {
  const run = createRun({ ruleset, map: switchback, seed });
  must(run, { type: "sendWave" });
  for (const t of towers) {
    expect(switchback.isBuildable(t.cell)).toBe(true);
    must(run, { type: "placeTower", kind: t.kind, cell: t.cell });
  }
  return run;
}

/** One Snapshot per tick, index i being the Snapshot before tick i is stepped. */
function trace(run: Run, ticks: number): Snapshot[] {
  const out: Snapshot[] = [run.snapshot()];
  for (let i = 0; i < ticks; i += 1) {
    run.step();
    out.push(run.snapshot());
  }
  return out;
}

function projectileSequence(snapshots: readonly Snapshot[]): readonly (readonly ProjectileSnapshot[])[] {
  return snapshots.map((s) => s.projectiles);
}

describe("Little Red Spammer (towers research 1.1, 1.3)", () => {
  it("is exposed in the Snapshot as $800, 600 damage, Range 3.6, 0.1 s cooldown, Random with no lock", () => {
    const t = tower(runWith(rich, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }]).snapshot(), 1);
    expect(t).toMatchObject({
      kind: "littleRedSpammer",
      damage: SPAMMER_DAMAGE,
      range: SPAMMER_RANGE,
      cooldown: 0.1,
      spend: 800,
      mode: "random",
      selectableModes: false,
      lockable: false,
      lock: false,
      targetId: null,
    });
  });

  it("launches one spamRocket every 12 ticks from a point inside its own Cell once a Vectoid is in Range", () => {
    const run = runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }]);
    stepTicks(run, LEADERS_ENTER_TICK);
    expect(run.snapshot().projectiles).toEqual([]);
    run.step(); // tick 30: the leaders come on field and the first rocket launches
    let s = run.snapshot();
    expect(s.projectiles).toHaveLength(1);
    const first = projectile(s, 1);
    expect(first).toMatchObject({ id: 1, kind: "spamRocket", towerId: 1 });
    expect([1, 15]).toContain(first.targetId);
    // Launched inside the Cell (3,0) and flown for one tick of at most 0.03 Cells.
    const flown = (SPAM_ROCKET_SPEED_MIN + ROCKET_ACCELERATION_PER_TICK) / TICKS_PER_SECOND;
    expect(first.x).toBeGreaterThanOrEqual(SPAMMER_CELL.col - flown);
    expect(first.x).toBeLessThanOrEqual(SPAMMER_CELL.col + 1 + flown);
    expect(first.y).toBeGreaterThanOrEqual(SPAMMER_CELL.row - flown);
    expect(first.y).toBeLessThanOrEqual(SPAMMER_CELL.row + 1 + flown);
    stepTicks(run, SPAMMER_PERIOD_TICKS - 1);
    expect(run.snapshot().projectiles).toHaveLength(1); // still cooling down
    run.step(); // tick 42: the second rocket
    s = run.snapshot();
    expect(s.projectiles.map((p) => p.id)).toEqual([1, 2]);
    expect(projectile(s, 2).kind).toBe("spamRocket");
  });

  it("a rocket starts at 3.2 Cells/s, gains 6.4/120 per tick, and caps at 6.4 (spec Units and time)", () => {
    const run = runWith(sturdy, [{ kind: "littleRedSpammer", cell: FAR_SPAMMER_CELL }]);
    stepTicks(run, LEADERS_ENTER_TICK + 1);
    expect(inRangeOf(run.snapshot(), tower(run.snapshot(), 1))).toEqual([15]);
    const launchTick = LEADERS_ENTER_TICK;
    const capTick = (SPAM_ROCKET_SPEED_MAX - SPAM_ROCKET_SPEED_MIN) / ROCKET_ACCELERATION_PER_TICK; // 60 ticks
    let k = 1;
    for (;;) {
      const s = run.snapshot();
      const p = s.projectiles.find((x) => x.id === 1);
      if (p === undefined) break;
      expect(s.tick).toBe(launchTick + k);
      expect(p.speed).toBeCloseTo(Math.min(SPAM_ROCKET_SPEED_MAX, SPAM_ROCKET_SPEED_MIN + k * ROCKET_ACCELERATION_PER_TICK), 12);
      run.step();
      k += 1;
    }
    expect(k).toBeGreaterThan(capTick + 5); // it flew at the cap for a while before arriving
  });

  it("picks a uniformly random Vectoid in Range for every rocket: targets vary and are never out of Range", () => {
    const run = runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }]);
    const snapshots = trace(run, 600);
    const seen = new Set<number>();
    const launches: { readonly target: number; readonly candidates: number[] }[] = [];
    for (const s of snapshots) {
      for (const p of s.projectiles) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (p.targetId === null) throw new Error("a Spammer rocket launched without a target");
        launches.push({ target: p.targetId, candidates: inRangeOf(s, tower(s, 1)) });
      }
    }
    expect(launches.length).toBeGreaterThanOrEqual(40);
    for (const l of launches) expect(l.candidates).toContain(l.target);
    expect(new Set(launches.map((l) => l.target)).size).toBeGreaterThan(3);
    // Not a deterministic mode in disguise: some rocket skipped the earliest-spawned candidate.
    expect(launches.some((l) => l.target !== Math.min(...l.candidates))).toBe(true);
  });

  it("two Runs with the same Seed choose the same targets and spawn points; a different Seed does not (ADR 0003)", () => {
    const a = projectileSequence(trace(runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }], 7), 600));
    const b = projectileSequence(trace(runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }], 7), 600));
    const c = projectileSequence(trace(runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }], 8), 600));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    const targets = (seq: readonly (readonly ProjectileSnapshot[])[]): (number | null)[] => seq.flatMap((ps) => ps.map((p) => p.targetId));
    expect(targets(a)).not.toEqual(targets(c));
  });

  it("deals 600 x the colour multiplier on impact: 600 to a Blue Spinner, 900 to Wave 2's Red Shredder (towers research 2.1)", () => {
    const firstImpact = (run: Run): { readonly before: Snapshot; readonly after: Snapshot; readonly victim: number } => {
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
      const hit = after.vectoids.filter((v) => v.hp !== v.maxHp);
      expect(hit).toHaveLength(1);
      const victim = hit[0];
      if (victim === undefined) throw new Error("unreachable");
      return { before, after, victim: victim.id };
    };

    const blue = runWith(sturdy, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }]);
    const b = firstImpact(blue);
    expect(vectoid(b.after, b.victim).type).toBe("blueSpinner");
    expect(vectoid(b.before, b.victim).hp - vectoid(b.after, b.victim).hp).toBe(SPAMMER_DAMAGE);
    // The rocket that hit it is gone, and it was the one aimed at the victim.
    const gone = b.before.projectiles.filter((p) => !b.after.projectiles.some((q) => q.id === p.id));
    expect(gone).toHaveLength(1);
    expect(gone[0]?.targetId).toBe(b.victim);

    // Send Wave 1, walk it 15 s out of reach, then Send Wave 2 (Red Shredders) and place the Spammer.
    const red = createRun({ ruleset: sturdy, map: switchback, seed: 1 });
    must(red, { type: "sendWave" });
    stepTicks(red, 15 * TICKS_PER_SECOND);
    must(red, { type: "sendWave" });
    must(red, { type: "placeTower", kind: "littleRedSpammer", cell: SPAMMER_CELL });
    const r = firstImpact(red);
    expect(vectoid(r.after, r.victim).type).toBe("redShredder");
    expect(vectoid(r.before, r.victim).hp - vectoid(r.after, r.victim).hp).toBe(SPAMMER_DAMAGE * 1.5);
  });

  it("a rocket whose target dies in flight vanishes without damaging anything (Original hit points: one rocket kills)", () => {
    const run = runWith(rich, [{ kind: "littleRedSpammer", cell: SPAMMER_CELL }]);
    // Find a tick where at least two rockets are aimed at one Vectoid and that Vectoid dies.
    let before = run.snapshot();
    let victim: number | null = null;
    let orphans: ProjectileSnapshot[] = [];
    let killEvents: readonly SimEvent[] = [];
    for (let i = 0; i < 1200 && victim === null; i += 1) {
      before = run.snapshot();
      const events = run.step();
      for (const k of eventsOfType(events, "killed")) {
        const aimed = before.projectiles.filter((p) => p.targetId === k.vectoidId);
        if (aimed.length >= 2) {
          victim = k.vectoidId;
          orphans = aimed;
          killEvents = events;
          break;
        }
      }
    }
    if (victim === null) throw new Error("no kill with a second rocket in flight within 1200 ticks");
    expect(eventsOfType(killEvents, "killed").filter((k) => k.vectoidId === victim)).toHaveLength(1);
    // Rockets tick in launch order, so an orphan launched before the killer flies one more tick.
    const later = stepTicks(run, 2);
    const after = run.snapshot();
    for (const p of orphans) expect(after.projectiles.some((q) => q.id === p.id)).toBe(false);
    expect(eventsOfType(later, "killed").some((k) => k.vectoidId === victim)).toBe(false);
    // Nobody else lost a single hit point: every survivor is exactly as it was, and every kill was a full 600-damage hit.
    for (const v of after.vectoids) expect(v.hp).toBe(vectoid(before, v.id).hp);
    for (const v of after.vectoids) expect(v.hp).toBe(WAVE_1_HP);
    expect(eventsOfType([...killEvents, ...later], "killed").every((k) => k.towerId === 1 && k.bounty === WAVE_1_BOUNTY)).toBe(true);
  });
});

describe("Red Rockets (towers research 1.1, 1.3, 3.1, 3.2)", () => {
  it("is exposed in the Snapshot as $2500, 30000 damage, Range 6, 1.125 s cooldown, Hard by default with lock on", () => {
    const t = tower(runWith(rich, [{ kind: "redRockets", cell: ROCKETS_CELL }]).snapshot(), 1);
    expect(t).toMatchObject({
      kind: "redRockets",
      damage: ROCKETS_DAMAGE,
      range: ROCKETS_RANGE,
      cooldown: 1.125,
      spend: 2500,
      mode: "hard",
      selectableModes: true,
      lockable: true,
      lock: true,
    });
  });

  it("launches one homingRocket from the Tower centre at rest every 135 ticks; lock on keeps both in flight on the same target", () => {
    const run = runWith(sturdy, [{ kind: "redRockets", cell: ROCKETS_CELL }]);
    stepTicks(run, LEADERS_ENTER_TICK);
    expect(run.snapshot().projectiles).toEqual([]);
    run.step(); // tick 30: the leaders enter Range 6 of (6.5, 0.5) and the first rocket launches
    let s = run.snapshot();
    expect(s.projectiles).toHaveLength(1);
    const first = projectile(s, 1);
    // Hard: both leaders untouched, so the earliest spawned (1) wins the tie.
    expect(first).toMatchObject({ id: 1, kind: "homingRocket", towerId: 1, targetId: 1 });
    expect(tower(s, 1).targetId).toBe(1);
    // One tick of flight from rest moves it 6.4/120/120 Cells from the centre.
    expect(first.x).toBeCloseTo(ROCKETS_CELL.col + 0.5, 3);
    expect(first.y).toBeCloseTo(ROCKETS_CELL.row + 0.5, 3);
    expect(first.speed).toBeCloseTo(ROCKET_ACCELERATION_PER_TICK, 12);
    stepTicks(run, ROCKETS_PERIOD_TICKS - 1);
    expect(run.snapshot().projectiles.map((p) => p.id)).toEqual([1]);
    run.step(); // tick 165: the second rocket, the first still in flight
    s = run.snapshot();
    expect(s.projectiles.map((p) => ({ id: p.id, kind: p.kind, targetId: p.targetId }))).toEqual([
      { id: 1, kind: "homingRocket", targetId: 1 },
      { id: 2, kind: "homingRocket", targetId: 1 },
    ]);
  });

  it("a rocket accelerates from rest by 6.4/120 per tick and caps at 4.8 Cells/s after 90 ticks (spec Units and time)", () => {
    const run = runWith(sturdy, [{ kind: "redRockets", cell: ROCKETS_CELL }]);
    stepTicks(run, LEADERS_ENTER_TICK + 1);
    const capTick = HOMING_ROCKET_SPEED_MAX / ROCKET_ACCELERATION_PER_TICK; // 90 ticks
    let k = 1;
    for (;;) {
      const s = run.snapshot();
      const p = s.projectiles.find((x) => x.id === 1);
      if (p === undefined) break;
      expect(s.tick).toBe(LEADERS_ENTER_TICK + k);
      expect(p.speed).toBeCloseTo(Math.min(HOMING_ROCKET_SPEED_MAX, k * ROCKET_ACCELERATION_PER_TICK), 12);
      run.step();
      k += 1;
    }
    expect(k).toBeGreaterThan(capTick + ROCKETS_PERIOD_TICKS - 90); // in flight past the second launch
  });

  it("lock off re-picks by Hard for every rocket: after a Green Laser 1 wears the first target down, the second rocket flies at a fresh Vectoid", () => {
    const scenario = (lock: boolean): Snapshot => {
      // Rockets first (Tower 1) so it picks before the laser (Tower 2) lands its first hit.
      const run = runWith(sturdy, [
        { kind: "redRockets", cell: ROCKETS_CELL },
        { kind: "greenLaser1", cell: LASER_CELL },
      ]);
      if (!lock) must(run, { type: "setTargetLock", towerId: 1, lock: false });
      stepTicks(run, LEADERS_ENTER_TICK + ROCKETS_PERIOD_TICKS + 1);
      return run.snapshot();
    };
    const held = scenario(true);
    expect(held.projectiles.map((p) => p.targetId)).toEqual([1, 1]);

    const free = scenario(false);
    expect(tower(free, 1).lock).toBe(false);
    expect(tower(free, 2).targetId).toBe(1);
    // The laser has hit 1 for 136 ticks; 2, 3, 15, 16, 17 are in Range untouched and 2 spawned first.
    expect(vectoid(free, 1).hp).toBeCloseTo(100_000 - 136 * GREEN_LASER_1_PER_TICK, 6);
    expect(vectoid(free, 2).hp).toBe(100_000);
    expect(inRangeOf(free, tower(free, 1))).toEqual([1, 2, 3, 15, 16, 17]);
    expect(free.projectiles.map((p) => p.targetId)).toEqual([1, 2]);
    expect(free.projectiles).toHaveLength(2); // two rockets in flight at different targets
  });

  it("a rocket whose target dies in flight retargets the nearest Vectoid and kills a Wave 1 Spinner on impact with 30000 x 1", () => {
    // Rockets first (Tower 1): it fires at 1 at tick 30 and the laser (Tower 2) kills 1 at 550 / 7.33 = 75 ticks later.
    const run = runWith(rich, [
      { kind: "redRockets", cell: ROCKETS_CELL },
      { kind: "greenLaser1", cell: LASER_CELL },
    ]);
    let before = run.snapshot();
    const events = stepUntil(
      run,
      (s, tickEvents) => {
        const killed = eventsOfType(tickEvents, "killed").some((k) => k.vectoidId === 1);
        if (!killed) before = s;
        return killed;
      },
      600,
    );
    const kill = eventsOfType(events, "killed").find((k) => k.vectoidId === 1);
    expect(kill).toMatchObject({ vectoidId: 1, towerId: 2, bounty: WAVE_1_BOUNTY });
    expect(before.projectiles.map((p) => ({ id: p.id, targetId: p.targetId }))).toEqual([{ id: 1, targetId: 1 }]);
    const after = run.snapshot();
    const rocket = projectile(after, 1);
    // The Towers act before projectiles, so the rocket retargeted the same tick: nearest to where it was, among the Vectoids as they now stand.
    const retarget = nearestTo(after, projectile(before, 1).x, projectile(before, 1).y);
    expect(retarget).not.toBeNull();
    expect(retarget).not.toBe(1);
    expect(rocket.targetId).toBe(retarget);
    if (retarget === null) throw new Error("unreachable");
    expect(vectoid(after, retarget).hp).toBeLessThanOrEqual(WAVE_1_HP);

    const impact = stepUntil(run, (_s, tickEvents) => eventsOfType(tickEvents, "killed").some((k) => k.towerId === 1), 600);
    expect(eventsOfType(impact, "killed").filter((k) => k.towerId === 1)).toEqual([
      { type: "killed", tick: run.tick - 1, vectoidId: retarget, towerId: 1, bounty: WAVE_1_BOUNTY },
    ]);
    expect(run.snapshot().projectiles.some((p) => p.id === 1)).toBe(false);
  });

  it("a rocket with no Vectoid left to retarget expires harmlessly", () => {
    // Every Vectoid has 1 hp: the Spammer (Tower 1) clears Wave 1 while Red Rockets (Tower 2) keep one rocket in flight.
    const run = runWith(oneHp, [
      { kind: "littleRedSpammer", cell: SPAMMER_CELL },
      { kind: "redRockets", cell: ROCKETS_CELL },
    ]);
    let before = run.snapshot();
    stepUntil(
      run,
      (s, tickEvents) => {
        const cleared = eventsOfType(tickEvents, "waveCleared").length > 0;
        if (!cleared) before = s;
        return cleared;
      },
      3000,
    );
    const inFlight = before.projectiles.filter((p) => p.kind === "homingRocket");
    expect(inFlight.length).toBeGreaterThan(0);
    expect(run.snapshot().vectoids).toEqual([]);
    const later = stepTicks(run, 2);
    const after = run.snapshot();
    expect(after.projectiles).toEqual([]);
    expect(later).toEqual([]);
    expect(after.economy.lives).toBe(before.economy.lives);
    expect(after.economy.bank).toBe(run.snapshot().economy.bank);
  });
});

describe("Blue Frost Rockets share the homing rocket and slow every Vectoid near the impact (ADR 0001 improvement 2)", () => {
  it("under Classic the primary takes damage x 1.5 against a Blue Spinner and everything within 1.5 Cells drops to maxSpeed / 2 (ADR 0001 item 2, M1-18)", () => {
    const frosty = overrideRuleset(classic, { startBank: 10_000, startHp: 100_000, lives: 100_000, maxAliveToSend: 100_000, suffix: "frost" });
    const run = runWith(frosty, [{ kind: "blueFrostRockets", cell: SPAMMER_CELL }]);
    const t = tower(run.snapshot(), 1);
    expect(t.kind).toBe("blueFrostRockets");
    let before = run.snapshot();
    stepUntil(
      run,
      (s) => {
        const hit = s.vectoids.some((v) => v.hp !== v.maxHp);
        if (!hit) before = s;
        return hit;
      },
      1200,
    );
    const after = run.snapshot();
    const rocket = before.projectiles[0];
    if (rocket?.targetId === null || rocket === undefined) throw new Error("no rocket in flight before the impact");
    const primary = vectoid(after, rocket.targetId);
    expect(before.projectiles).toHaveLength(1);
    expect(after.projectiles).toEqual([]);
    expect(vectoid(before, primary.id).hp - primary.hp).toBeCloseTo(t.damage * 1.5, 9);
    const near = after.vectoids.filter((v) => onField(v) && distance(primary.x, primary.y, v.x, v.y) <= 1.5); // splash radius, ADR 0001 item 2
    expect(near.map((v) => v.id)).toContain(primary.id);
    expect(near.length).toBeGreaterThan(1);
    for (const v of near) {
      expect(v.speed).toBeCloseTo(v.maxSpeed / 2, 12); // slow factor 1/2, ADR 0001 item 2
      expect(vectoid(before, v.id).hp - v.hp).toBeCloseTo(t.damage * 1.5, 9);
    }
    for (const v of after.vectoids) {
      if (near.some((n) => n.id === v.id)) continue;
      expect(v.speed).toBe(v.maxSpeed);
      expect(v.hp).toBe(v.maxHp);
    }
  });
});
