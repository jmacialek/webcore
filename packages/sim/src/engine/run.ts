import type { RunInputs, SimEvent, Snapshot } from "../types.js";

/** A live Run: step it and read Snapshots and Events. */
export interface Run {
  /** Advance one fixed 1/120 s tick and return the Events it produced. */
  step(): readonly SimEvent[];
  /** The Snapshot of the current tick. */
  snapshot(): Snapshot;
}

class RunImpl implements Run {
  #tick = 0;
  readonly #seed: number;

  constructor(inputs: RunInputs) {
    this.#seed = inputs.seed;
  }

  step(): readonly SimEvent[] {
    this.#tick += 1;
    return [];
  }

  snapshot(): Snapshot {
    return { tick: this.#tick, seed: this.#seed };
  }
}

export function createRun(inputs: RunInputs): Run {
  return new RunImpl(inputs);
}
