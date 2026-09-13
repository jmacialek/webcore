import { createRun } from "./engine/run.js";
import type { Run } from "./engine/run.js";
import { digestValue, RollingDigest } from "./engine/digest.js";
import { getMap } from "./map/index.js";
import type { GameMap } from "./map/types.js";
import { getRuleset } from "./ruleset/index.js";
import type { Ruleset } from "./ruleset/types.js";
import type { CommandResult, RunOutcome, SerialisedRun, SimEvent, Snapshot } from "./types.js";

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
  /** Per-tick Snapshot digests, index 0 being the state before the first step. */
  readonly tickDigests: readonly string[];
  /** Per-tick digests of the Events each step produced, index 0 being an empty list. */
  readonly tickEventDigests: readonly string[];
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
  const tickEventDigests: string[] = [];
  const record = (events: readonly SimEvent[]): void => {
    const d = run.digest();
    const e = digestValue(events);
    tickDigests.push(d);
    tickEventDigests.push(e);
    rolling.add(d);
    rolling.add(e);
    onTick?.(run);
  };
  const results: CommandResult[] = [];
  record([]);
  for (const command of serialised.commands) {
    while (run.tick < command.tick && run.tick < serialised.ticks) {
      record(run.step());
    }
    results.push(run.apply(command));
  }
  while (run.tick < serialised.ticks) {
    record(run.step());
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
    tickEventDigests,
  };
}
