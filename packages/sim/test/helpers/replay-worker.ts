/**
 * Worker-thread replay for determinism.test.ts.
 *
 * The test spawns this file with `node:worker_threads`, so it runs under
 * plain Node (built-in type stripping), not Vitest: a separate thread with
 * its own module graph, its own JIT state, and no Vite transform. Its
 * per-tick digests must match the main thread's exactly (spec
 * "Determinism", ADR 0003).
 *
 * The sim writes NodeNext `./x.js` specifiers that only resolve to `.ts`
 * sources under TypeScript or Vite resolution; Node strips types but never
 * rewrites specifiers, so a path-like `.js` specifier that is not on disk
 * is retried as `.ts` (the same approach as harness/loader.ts). The sim is
 * imported dynamically, after the hook is registered.
 *
 * Protocol: one `ReplayRequest` message in, one `ReplayReply` out, matched
 * by `id`; the worker stays alive until the test terminates it. Rulesets
 * are plain data and travel by structured clone; Maps hold functions, so
 * only built-in Maps (resolved by id in this thread) are supported.
 */
import { registerHooks } from "node:module";
import { parentPort } from "node:worker_threads";
import type { CommandResult, Ruleset, RunOutcome, SerialisedRun } from "../../src/index.js";

export interface ReplayRequest {
  readonly id: number;
  readonly serialised: SerialisedRun;
  readonly ruleset: Ruleset;
}

export interface ReplayReply {
  readonly id: number;
  readonly tickDigests: readonly string[];
  readonly finalDigest: string;
  readonly rollingDigest: string;
  readonly outcome: RunOutcome | null;
  readonly score: number;
  readonly results: readonly CommandResult[];
}

function isModuleNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
}

function isPathLike(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error: unknown) {
      if (isModuleNotFound(error) && isPathLike(specifier) && specifier.endsWith(".js")) {
        return nextResolve(`${specifier.slice(0, -".js".length)}.ts`, context);
      }
      throw error;
    }
  },
});

const sim = await import("../../src/index.js");

if (parentPort === null) throw new Error("replay-worker.ts must run as a worker thread");
const port = parentPort;

port.on("message", (request: ReplayRequest) => {
  const replay = sim.replayRun(request.serialised, {
    ruleset: () => request.ruleset,
    map: (id) => sim.defaultResolver.map(id),
  });
  const reply: ReplayReply = {
    id: request.id,
    tickDigests: replay.tickDigests,
    finalDigest: replay.finalDigest,
    rollingDigest: replay.rollingDigest,
    outcome: replay.outcome,
    score: replay.score,
    results: replay.results,
  };
  port.postMessage(reply);
});
