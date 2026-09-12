import { createRun } from "./engine/run.js";
import type { Run } from "./engine/run.js";
import { RollingDigest } from "./engine/digest.js";
import { getMap } from "./map/index.js";
import type { GameMap } from "./map/types.js";
import { getRuleset } from "./ruleset/index.js";
import type { Ruleset } from "./ruleset/types.js";
import type { CommandResult, RunOutcome, SerialisedRun, Snapshot } from "./types.js";

export interface ReplayResolver {
  ruleset(id: string, version: string): Ruleset | undefined;
  map(id: string): GameMap | undefined;
}

export const defaultResolver: ReplayResolver = {
  ruleset: (id) => getRuleset(id),
  map: (id) => getMap(id),
};

export interface ReplayResult {
  readonly snapshot: Snapshot;
  readonly score: number;
  readonly outcome: RunOutcome | null;
  readonly results: readonly CommandResult[];
  /** Digest of the final Snapshot. */
  readonly finalDigest: string;
  /** Fold of every per-tick digest, so mid-Run drift is caught too. */
  readonly rollingDigest: string;
  /** Per-tick digests, index 0 being the state before the first step. */
  readonly tickDigests: readonly string[];
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

/**
 * Replay a serialised Run and return its final Snapshot and Score (ADR 0003).
 * Commands are applied at their recorded tick, in log order; rejected ones
 * are rejected again identically.
 */
export function replayRun(
  serialised: SerialisedRun,
  resolver: ReplayResolver = defaultResolver,
  onTick?: (run: Run) => void,
): ReplayResult {
  const ruleset = resolver.ruleset(serialised.rulesetId, serialised.rulesetVersion);
  if (ruleset === undefined) throw new ReplayError(`unknown Ruleset ${serialised.rulesetId}`);
  if (ruleset.version !== serialised.rulesetVersion) {
    throw new ReplayError(`Ruleset ${serialised.rulesetId} is ${ruleset.version}, Run needs ${serialised.rulesetVersion}`);
  }
  const map = resolver.map(serialised.mapId);
  if (map === undefined) throw new ReplayError(`unknown Map ${serialised.mapId}`);

  const run = createRun({ ruleset, map, seed: serialised.seed });
  const rolling = new RollingDigest();
  const tickDigests: string[] = [];
  const record = (): void => {
    const d = run.digest();
    tickDigests.push(d);
    rolling.add(d);
    onTick?.(run);
  };
  const results: CommandResult[] = [];
  record();
  for (const command of serialised.commands) {
    while (run.tick < command.tick && run.tick < serialised.ticks) {
      run.step();
      record();
    }
    results.push(run.apply(command));
  }
  while (run.tick < serialised.ticks) {
    run.step();
    record();
  }
  const snapshot = run.snapshot();
  return {
    snapshot,
    score: snapshot.economy.score,
    outcome: snapshot.outcome,
    results,
    finalDigest: run.digest(),
    rollingDigest: rolling.value,
    tickDigests,
  };
}
