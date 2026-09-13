/**
 * Table-driven replay fixtures. Every rule ticket adds a
 * `fixtures/<name>.fixture.ts` (the Command Log, built through the public
 * surface) and this test compares its replay against
 * `fixtures/<name>.expected.json`. Regenerate with
 * `UPDATE_FIXTURES=1 pnpm vitest run packages/sim/test/fixtures.test.ts`.
 *
 * Three things are asserted per fixture: the live Run, with digests
 * recorded while it was actually being played, and its replay agree on
 * every tick's Snapshot and Event digests (determinism); a second replay
 * agrees with the first (stability); the replay matches the checked-in
 * expectation (drift). A missing expectation fails rather than being
 * generated silently, so a forgotten baseline cannot pass.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { replayRun } from "../src/index.js";
import type { Fixture } from "./helpers/fixtures.js";

interface Expected {
  readonly ticks: number;
  readonly outcome: string | null;
  readonly score: number;
  readonly finalDigest: string;
  readonly rollingDigest: string;
}

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".fixture.ts"))
  .sort();

const fixtures: Fixture[] = [];
for (const file of files) {
  const mod = (await import(pathToFileURL(dir + file).href)) as { default: Fixture };
  fixtures.push(mod.default);
}

const update = process.env["UPDATE_FIXTURES"] === "1";

describe("replay fixtures", () => {
  it("has at least one fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  describe.each(fixtures.map((f) => [f.name, f] as const))("%s", (name, fixture) => {
    it("replays to the same per-tick digests as the live Run", () => {
      const live = fixture.trace();
      const serialised = live.run.serialise();
      const replay = replayRun(serialised, fixture.resolver);
      const again = replayRun(serialised, fixture.resolver);
      expect(live.tickDigests).toHaveLength(serialised.ticks + 1);
      expect(replay.tickDigests).toEqual(live.tickDigests);
      expect(replay.tickEventDigests).toEqual(live.tickEventDigests);
      expect(again.tickDigests).toEqual(replay.tickDigests);
      expect(again.tickEventDigests).toEqual(replay.tickEventDigests);
      expect(replay.finalDigest).toBe(live.run.digest());
      expect(replay.snapshot).toEqual(live.run.snapshot());
      expect(replay.results).toEqual(live.run.log().map((entry) => entry.result));
    });

    it("matches the checked-in expectation", () => {
      const serialised = fixture.build().serialise();
      const replay = replayRun(serialised, fixture.resolver);
      const actual: Expected = {
        ticks: serialised.ticks,
        outcome: replay.outcome,
        score: replay.score,
        finalDigest: replay.finalDigest,
        rollingDigest: replay.rollingDigest,
      };
      const path = `${dir}${name}.expected.json`;
      if (update) writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`);
      if (!existsSync(path)) {
        throw new Error(`${name} has no ${name}.expected.json; run with UPDATE_FIXTURES=1 to record it`);
      }
      const expected = JSON.parse(readFileSync(path, "utf8")) as Expected;
      expect(actual).toEqual(expected);
    });
  });
});
