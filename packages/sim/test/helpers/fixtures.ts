import type { GameMap, ReplayResolver, Ruleset, Run } from "../../src/index.js";
import { defaultResolver } from "../../src/index.js";

/**
 * A replay fixture: a builder that drives a Run through the public surface,
 * plus the resolver needed to replay it (custom Rulesets and Maps must be
 * registered here because they are not built in).
 */
export interface Fixture {
  readonly name: string;
  readonly build: () => Run;
  readonly resolver: ReplayResolver;
}

export interface FixtureOptions {
  readonly rulesets?: readonly Ruleset[];
  readonly maps?: readonly GameMap[];
}

export function defineFixture(name: string, build: () => Run, options: FixtureOptions = {}): Fixture {
  const rulesets = options.rulesets ?? [];
  const maps = options.maps ?? [];
  const resolver: ReplayResolver = {
    ruleset: (id, version) => rulesets.find((r) => r.id === id && r.version === version) ?? defaultResolver.ruleset(id, version),
    map: (id) => maps.find((m) => m.id === id) ?? defaultResolver.map(id),
  };
  return { name, build, resolver };
}

/** A Ruleset with test-only overrides. Its id and version are changed so it can never be mistaken for a real one. */
export function overrideRuleset(
  base: Ruleset,
  patch: { lives?: number; startHp?: number; maxAliveToSend?: number; suffix: string },
): Ruleset {
  const tiers = { ...base.economy.tiers };
  if (patch.startHp !== undefined) {
    for (const tier of ["easy", "normal", "hard"] as const) {
      tiers[tier] = { ...tiers[tier], startHp: patch.startHp };
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
  };
}
