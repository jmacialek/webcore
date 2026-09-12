import type { Command, Run, SimEvent, Snapshot } from "../../src/index.js";

/** Step `n` ticks, returning every Event in order. */
export function stepTicks(run: Run, n: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i += 1) events.push(...run.step());
  return events;
}

/** Step until the predicate holds or `maxTicks` pass; returns the Events seen. */
export function stepUntil(run: Run, predicate: (snapshot: Snapshot, events: readonly SimEvent[]) => boolean, maxTicks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i += 1) {
    const tickEvents = run.step();
    events.push(...tickEvents);
    if (predicate(run.snapshot(), tickEvents)) return events;
  }
  throw new Error(`predicate not met within ${String(maxTicks)} ticks`);
}

export function stepUntilEnded(run: Run, maxTicks: number): SimEvent[] {
  return stepUntil(run, (s) => s.outcome !== null, maxTicks);
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A Command without its tick; `at` and `must` stamp the Run's current tick. */
export type UntickedCommand = DistributiveOmit<Command, "tick">;

export function at(run: Run, command: UntickedCommand): Command {
  return { ...command, tick: run.tick };
}

/** Apply a Command at the Run's current tick and fail loudly if rejected. */
export function must(run: Run, command: UntickedCommand): void {
  const result = run.apply(at(run, command));
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.reason}`);
}

export function eventsOfType<T extends SimEvent["type"]>(events: readonly SimEvent[], type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}
