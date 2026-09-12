/** Inputs that fully determine a Run (ADR 0003). Placeholders until M1-03/04. */
export interface RunInputs {
  readonly rulesetId: string;
  readonly mapId: string;
  readonly seed: number;
}

/** Plain, serialisable value describing one tick. Grows in M1-04. */
export interface Snapshot {
  readonly tick: number;
  readonly seed: number;
}

/** Events emitted during a tick. Populated from M1-04 onward. */
export interface SimEvent {
  readonly type: "noop";
}
