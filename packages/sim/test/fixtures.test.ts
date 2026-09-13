/**
 * Table-driven replay fixtures. Every rule ticket adds a
 * `fixtures/<name>.fixture.ts` (the Command Log, built through the public
 * surface) and this test compares its replay against
 * `fixtures/<name>.expected.json`. Regenerate with
 * `UPDATE_FIXTURES=1 pnpm vitest run packages/sim/test/fixtures.test.ts`.
 *
 * Three things are asserted per fixture: the live Run and its replay agree
 * on every tick's Snapshot and Event digests (determinism); a second replay
 * agrees with the first (stability); the replay matches the checked-in
 * expectation (drift).
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
      const live = fixture.build();
      const serialised = live.serialise();
      const liveDigests: string[] = [];
      // Re-drive the same build to capture per-tick digests of a live Run.
      const again = replayRun(serialised, fixture.resolver, (run) => liveDigests.push(run.digest()));
      const replay = replayRun(serialised, fixture.resolver);
      expect(replay.tickDigests).toEqual(liveDigests);
      expect(replay.tickDigests).toEqual(again.tickDigests);
      expect(replay.tickEventDigests).toEqual(again.tickEventDigests);
      expect(replay.tickEventDigests).toHaveLength(replay.tickDigests.length);
      expect(replay.finalDigest).toBe(live.digest());
      expect(replay.snapshot).toEqual(live.snapshot());
      expect(replay.results).toEqual(live.log().map((entry) => entry.result));
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
      if (update || !existsSync(path)) {
        writeFileSync(path, `${JSON.stringify(actual, null, 2)}\n`);
      }
      const expected = JSON.parse(readFileSync(path, "utf8")) as Expected;
      expect(actual).toEqual(expected);
    });
  });
});
