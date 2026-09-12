import type { GameMap } from "../map/types.js";
import type { Ruleset } from "../ruleset/types.js";
import type { Command, CommandResult, LoggedCommand, SerialisedRun, SimEvent, Snapshot } from "../types.js";
import { applyCommand } from "./commands.js";
import { digestValue } from "./digest.js";
import { Engine } from "./engine.js";
import { buildSnapshot } from "./snapshot.js";

export interface RunInputs {
  readonly ruleset: Ruleset;
  readonly map: GameMap;
  readonly seed: number;
}

/**
 * A live Run (ADR 0003): apply Commands at the current tick, step, and read
 * Snapshots, Events, and digests. The Command Log records every Command
 * with its result, accepted or rejected.
 */
export interface Run {
  /** Index of the tick the next `step()` will simulate. */
  readonly tick: number;
  /** Validate and apply a Command at the current tick. */
  apply(command: Command): CommandResult;
  /** Advance one fixed 1/120 s tick and return the Events it produced. */
  step(): readonly SimEvent[];
  /** The Snapshot of the current state. */
  snapshot(): Snapshot;
  /** Digest of the current Snapshot. */
  digest(): string;
  /** Every Command applied so far, with its result. */
  log(): readonly LoggedCommand[];
  /** The complete serialisable record of this Run so far. */
  serialise(): SerialisedRun;
}

class RunImpl implements Run {
  readonly #engine: Engine;
  readonly #log: LoggedCommand[] = [];
  #snapshot: Snapshot | null = null;

  constructor(inputs: RunInputs) {
    this.#engine = new Engine(inputs);
  }

  get tick(): number {
    return this.#engine.tick;
  }

  apply(command: Command): CommandResult {
    const result = applyCommand(this.#engine, command);
    // A Command for another tick applied at no tick, so it is not part of
    // the Run; everything else, accepted or rejected, is recorded.
    if (result.ok || result.reason !== "outOfOrderTick") this.#log.push({ command, result });
    this.#snapshot = null;
    return result;
  }

  step(): readonly SimEvent[] {
    this.#engine.step();
    this.#snapshot = null;
    const events = this.#engine.pendingEvents.slice();
    this.#engine.pendingEvents.length = 0;
    return events;
  }

  snapshot(): Snapshot {
    this.#snapshot ??= buildSnapshot(this.#engine);
    return this.#snapshot;
  }

  digest(): string {
    return digestValue(this.snapshot());
  }

  log(): readonly LoggedCommand[] {
    return this.#log.slice();
  }

  serialise(): SerialisedRun {
    return {
      rulesetId: this.#engine.ruleset.id,
      rulesetVersion: this.#engine.ruleset.version,
      mapId: this.#engine.map.id,
      seed: this.#engine.seed,
      commands: this.#log.map((entry) => entry.command),
      ticks: this.#engine.tick,
    };
  }
}

export function createRun(inputs: RunInputs): Run {
  return new RunImpl(inputs);
}
