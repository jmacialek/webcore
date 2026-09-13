/**
 * M1-16: every fixture replays identically on the main thread and in a
 * worker thread (spec "Determinism", ADR 0003).
 *
 * The main thread runs the sim through Vitest's transform; the worker
 * (`helpers/replay-worker.ts`) runs the same source under plain Node type
 * stripping in a separate thread with its own module graph and JIT. If any
 * rule depended on evaluation order, engine-varying maths, a wall clock, or
 * unseeded randomness, the two per-tick digest streams would diverge.
 *
 * Fixtures are discovered the way fixtures.test.ts does. Rulesets are plain
 * data and are sent to the worker by structured clone (so test-only
 * override Rulesets work); Maps hold functions, so a fixture must use a
 * built-in Map.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultResolver, replayRun } from "../src/index.js";
import type { Fixture } from "./helpers/fixtures.js";
import type { ReplayReply, ReplayRequest } from "./helpers/replay-worker.js";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".fixture.ts"))
  .sort();

const fixtures: Fixture[] = [];
for (const file of files) {
  const mod = (await import(pathToFileURL(dir + file).href)) as { default: Fixture };
  fixtures.push(mod.default);
}

interface Pending {
  readonly resolve: (reply: ReplayReply) => void;
  readonly reject: (error: Error) => void;
}

let worker: Worker;
const pending = new Map<number, Pending>();
let nextId = 1;

function replayInWorker(serialised: ReplayRequest["serialised"], ruleset: ReplayRequest["ruleset"]): Promise<ReplayReply> {
  const id = nextId;
  nextId += 1;
  return new Promise<ReplayReply>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: ReplayRequest = { id, serialised, ruleset };
    worker.postMessage(request);
  });
}

beforeAll(() => {
  worker = new Worker(new URL("./helpers/replay-worker.ts", import.meta.url));
  worker.on("message", (reply: ReplayReply) => {
    const entry = pending.get(reply.id);
    if (entry === undefined) return;
    pending.delete(reply.id);
    entry.resolve(reply);
  });
  worker.on("error", (error: Error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  });
});

afterAll(async () => {
  await worker.terminate();
});

describe("worker-thread replay", () => {
  it("has fixtures to replay", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  describe.each(fixtures.map((f) => [f.name, f] as const))("%s", (_name, fixture) => {
    it("agrees with the main-thread replay on every tick", async () => {
      const serialised = fixture.build().serialise();
      const ruleset = fixture.resolver.ruleset(serialised.rulesetId, serialised.rulesetVersion);
      if (ruleset === undefined) throw new Error(`fixture cannot resolve its own Ruleset ${serialised.rulesetId}`);
      // The worker resolves Maps by id; a custom Map would need its text sent across as well.
      expect(defaultResolver.map(serialised.mapId), `Map ${serialised.mapId} is not built in`).toBeDefined();

      // Post to the worker first so both replays run at the same time; the fifty-Wave Run takes seconds to digest.
      const remotePromise = replayInWorker(serialised, ruleset);
      const main = replayRun(serialised, fixture.resolver);
      const remote = await remotePromise;

      expect(remote.tickDigests.length).toBe(serialised.ticks + 1);
      expect(remote.tickDigests).toEqual(main.tickDigests);
      expect(remote.tickEventDigests).toEqual(main.tickEventDigests);
      expect(remote.finalDigest).toBe(main.finalDigest);
      expect(remote.rollingDigest).toBe(main.rollingDigest);
      expect(remote.outcome).toBe(main.outcome);
      expect(remote.score).toBe(main.score);
      expect(remote.results).toEqual(main.results);
    }, 60_000);
  });
});
