/**
 * Balancing harness (M1-17): plays a build order headlessly like an eager
 * player without Auto (Sends every Wave the instant `canSend` holds) and
 * records per Wave the Leaks, Bank, Score, and time to clear.
 *
 * A developer tool, not public surface. It consumes the sim only through
 * `../src/index.js`, exactly as a client would.
 */
import { createRun, getMap, getRuleset, TICKS_PER_SECOND } from "../src/index.js";
import type { Command, RejectReason, Run, RunOutcome, SimEvent } from "../src/index.js";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A public Command without its tick; the harness stamps the Run's current tick. */
export type UntickedCommand = DistributiveOmit<Command, "tick">;

/**
 * "As soon as Wave `wave` has been Sent, apply these Commands in order."
 * Wave 0 means before the first Send. Tower ids are the sim's own: 1, 2, ...
 * in placement order.
 */
export interface BuildStep {
  readonly wave: number;
  readonly commands: readonly UntickedCommand[];
}

export interface BuildOrder {
  readonly name: string;
  readonly description: string;
  /** Ruleset the build order is written for; `HarnessOptions.ruleset` overrides it. */
  readonly ruleset: "original" | "classic";
  readonly steps: readonly BuildStep[];
}

export interface HarnessOptions {
  readonly ruleset?: string;
  readonly seed?: number;
  readonly map?: string;
  /** Ticks to simulate at most. Default 30 sim minutes. */
  readonly tickCap?: number;
}

export interface WaveRow {
  readonly wave: number;
  readonly sentTick: number;
  /** Leaks between this Send and the next (or the end). */
  readonly leaked: number;
  /** Bank at the moment of the next Send (or at the end). */
  readonly bank: number;
  readonly score: number;
  /** Seconds from the Send until the field was clear, or null if it never was before the next Send. */
  readonly clearSeconds: number | null;
}

export interface RejectedStep {
  readonly wave: number;
  readonly tick: number;
  readonly command: UntickedCommand;
  readonly reason: RejectReason;
}

export interface HarnessResult {
  readonly buildOrder: string;
  readonly rulesetId: string;
  readonly mapId: string;
  readonly seed: number;
  readonly waves: readonly WaveRow[];
  readonly rejected: readonly RejectedStep[];
  /** Null when the tick cap was reached first. */
  readonly outcome: RunOutcome | null;
  readonly capReached: boolean;
  readonly ticks: number;
  readonly score: number;
  readonly lives: number;
  readonly bank: number;
}

export const DEFAULT_TICK_CAP = 30 * 60 * TICKS_PER_SECOND;

/** Mutable per-Wave bookkeeping while the Wave is the latest one Sent. */
interface OpenWave {
  wave: number;
  sentTick: number;
  leaked: number;
  clearedTick: number | null;
}

function applyStep(run: Run, step: BuildStep, rejected: RejectedStep[]): void {
  for (const command of step.commands) {
    const result = run.apply({ ...command, tick: run.tick });
    if (!result.ok) rejected.push({ wave: step.wave, tick: run.tick, command, reason: result.reason });
  }
}

function closeWave(run: Run, open: OpenWave): WaveRow {
  const { economy } = run.snapshot();
  return {
    wave: open.wave,
    sentTick: open.sentTick,
    leaked: open.leaked,
    bank: economy.bank,
    score: economy.score,
    clearSeconds: open.clearedTick === null ? null : (open.clearedTick - open.sentTick) / TICKS_PER_SECOND,
  };
}

export function runHarness(buildOrder: BuildOrder, options: HarnessOptions = {}): HarnessResult {
  const rulesetId = options.ruleset ?? buildOrder.ruleset;
  const ruleset = getRuleset(rulesetId);
  if (ruleset === undefined) throw new Error(`unknown Ruleset "${rulesetId}"`);
  const mapId = options.map ?? "switchback";
  const map = getMap(mapId);
  if (map === undefined) throw new Error(`unknown Map "${mapId}"`);
  const seed = options.seed ?? 1;
  const tickCap = options.tickCap ?? DEFAULT_TICK_CAP;

  const stepsByWave = new Map<number, BuildStep[]>();
  for (const step of buildOrder.steps) {
    const list = stepsByWave.get(step.wave) ?? [];
    list.push(step);
    stepsByWave.set(step.wave, list);
  }
  const stepsFor = (wave: number): readonly BuildStep[] => stepsByWave.get(wave) ?? [];

  const run = createRun({ ruleset, map, seed });
  const rejected: RejectedStep[] = [];
  const waves: WaveRow[] = [];
  let open: OpenWave | null = null;
  let outcome: RunOutcome | null = null;

  for (const step of stepsFor(0)) applyStep(run, step, rejected);

  // Sending is possible only when the field has thinned, which only kills
  // change, so `canSend` is re-read only after a kill or a Send.
  let checkSend = true;
  while (run.tick < tickCap && outcome === null) {
    let sentThisTick = false;
    if (checkSend) {
      const { wave } = run.snapshot();
      checkSend = false;
      if (wave.canSend && wave.next !== null) {
        if (open !== null) waves.push(closeWave(run, open));
        const result = run.apply({ type: "sendWave", tick: run.tick });
        if (!result.ok) throw new Error(`sendWave rejected while canSend: ${result.reason}`);
        open = { wave: wave.next.wave, sentTick: run.tick, leaked: 0, clearedTick: null };
        sentThisTick = true;
      }
    }
    const events: readonly SimEvent[] = run.step();
    if (sentThisTick && open !== null) {
      for (const step of stepsFor(open.wave)) applyStep(run, step, rejected);
      checkSend = true;
    }
    for (const event of events) {
      switch (event.type) {
        case "killed":
          checkSend = true;
          break;
        case "leaked":
          if (open !== null) open.leaked += 1;
          break;
        case "waveCleared":
          if (open !== null && event.wave === open.wave) open.clearedTick = event.tick;
          break;
        case "runEnded":
          outcome = event.outcome;
          break;
        default:
          break;
      }
    }
  }
  if (open !== null) waves.push(closeWave(run, open));

  const { economy, tick } = run.snapshot();
  return {
    buildOrder: buildOrder.name,
    rulesetId: ruleset.id,
    mapId: map.id,
    seed,
    waves,
    rejected,
    outcome,
    capReached: outcome === null,
    ticks: tick,
    score: economy.score,
    lives: economy.lives,
    bank: economy.bank,
  };
}

function pad(value: string, width: number): string {
  return value.padStart(width);
}

/** The per-Wave table, warnings, and outcome as fixed-width text lines. */
export function formatReport(result: HarnessResult): string[] {
  const lines: string[] = [];
  lines.push(`${result.buildOrder} on ${result.mapId} under ${result.rulesetId} (seed ${String(result.seed)})`);
  lines.push("");
  for (const r of result.rejected) {
    lines.push(`warning: Wave ${String(r.wave)} tick ${String(r.tick)}: ${JSON.stringify(r.command)} rejected: ${r.reason}`);
  }
  if (result.rejected.length > 0) lines.push("");
  lines.push(`${pad("Wave", 4)} ${pad("Sent(s)", 8)} ${pad("Leaked", 6)} ${pad("Bank", 8)} ${pad("Score", 8)} ${pad("Clear(s)", 8)}`);
  for (const row of result.waves) {
    lines.push(
      [
        pad(String(row.wave), 4),
        pad((row.sentTick / TICKS_PER_SECOND).toFixed(1), 8),
        pad(String(row.leaked), 6),
        pad(String(row.bank), 8),
        pad(String(row.score), 8),
        pad(row.clearSeconds === null ? "-" : row.clearSeconds.toFixed(1), 8),
      ].join(" "),
    );
  }
  lines.push("");
  const ending = result.outcome ?? `tick cap reached after ${String(result.ticks)} ticks`;
  lines.push(`Outcome: ${ending}  Score: ${String(result.score)}  Lives: ${String(result.lives)}  Bank: ${String(result.bank)}  Time: ${(result.ticks / TICKS_PER_SECOND).toFixed(1)} s`);
  return lines;
}
