import type { GameMap, ReplayResolver, Ruleset, Run, RunInputs } from "../../src/index.js";
import { createRun, defaultResolver, digestValue } from "../../src/index.js";

export type CreateRun = (inputs: RunInputs) => Run;

/** A live Run together with the digests recorded while it was being played. */
export interface LiveTrace {
  readonly run: Run;
  /** Snapshot digest before the first step, then after every step. */
  readonly tickDigests: readonly string[];
  /** Digest of the Events each step produced, index 0 being an empty list. */
  readonly tickEventDigests: readonly string[];
}

/**
 * A replay fixture: a builder that drives a Run through the public surface,
 * plus the resolver needed to replay it (custom Rulesets and Maps must be
 * registered here because they are not built in). The builder takes the
 * `createRun` to use so `trace()` can hand it a recording one.
 */
export interface Fixture {
  readonly name: string;
  readonly build: () => Run;
  /** Play the fixture live, recording per-tick digests as it goes. */
  readonly trace: () => LiveTrace;
  readonly resolver: ReplayResolver;
}

/** Wrap a Run so every step records the digests a replay would compute at that tick. */
function recordingRun(run: Run, tickDigests: string[], tickEventDigests: string[]): Run {
  tickDigests.push(run.digest());
  tickEventDigests.push(digestValue([]));
  return {
    get tick() {
      return run.tick;
    },
    apply: (command) => run.apply(command),
    step: () => {
      const events = run.step();
      tickDigests.push(run.digest());
      tickEventDigests.push(digestValue(events));
      return events;
    },
    snapshot: () => run.snapshot(),
    digest: () => run.digest(),
    log: () => run.log(),
    serialise: () => run.serialise(),
  };
}

export interface FixtureOptions {
  readonly rulesets?: readonly Ruleset[];
  readonly maps?: readonly GameMap[];
}

export function defineFixture(name: string, build: (create: CreateRun) => Run, options: FixtureOptions = {}): Fixture {
  const rulesets = options.rulesets ?? [];
  const maps = options.maps ?? [];
  const resolver: ReplayResolver = {
    ruleset: (id, version) => rulesets.find((r) => r.id === id && r.version === version) ?? defaultResolver.ruleset(id, version),
    map: (id) => maps.find((m) => m.id === id) ?? defaultResolver.map(id),
  };
  const trace = (): LiveTrace => {
    const tickDigests: string[] = [];
    const tickEventDigests: string[] = [];
    let created = 0;
    const run = build((inputs) => {
      created += 1;
      if (created > 1) throw new Error(`fixture ${name} creates more than one Run`);
      return recordingRun(createRun(inputs), tickDigests, tickEventDigests);
    });
    return { run, tickDigests, tickEventDigests };
  };
  return { name, build: () => build(createRun), trace, resolver };
}

/** A Ruleset with test-only overrides. Its id and version are changed so it can never be mistaken for a real one. */
export function overrideRuleset(
  base: Ruleset,
  patch: { lives?: number; startHp?: number; startBank?: number; maxAliveToSend?: number; vectoidsPerLane?: number; suffix: string },
): Ruleset {
  const tiers = { ...base.economy.tiers };
  if (patch.startHp !== undefined) {
    for (const tier of ["easy", "normal", "hard"] as const) {
      tiers[tier] = { ...tiers[tier], startHp: patch.startHp };
    }
  }
  if (patch.startBank !== undefined) {
    for (const tier of ["easy", "normal", "hard"] as const) {
      tiers[tier] = { ...tiers[tier], startBank: patch.startBank };
    }
  }
  return {
    ...base,
    id: `${base.id}-test-${patch.suffix}`,
    version: `${base.version}-test`,
    economy: {
      ...base.economy,
      lives: patch.lives ?? base.economy.lives,
      maxAliveToSend: patch.maxAliveToSend ?? base.economy.maxAliveToSend,
      tiers,
    },
    movement: {
      ...base.movement,
      vectoidsPerLane: patch.vectoidsPerLane ?? base.movement.vectoidsPerLane,
    },
  };
}
