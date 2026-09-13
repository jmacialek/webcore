/**
 * M1-16: the replay fixture suite covers every rule that ships in Classic.
 *
 * Every fixture is built through the public surface and its Command Log
 * inspected: the accepted placeTower kinds must span all twelve Classic
 * Towers, placeBooster both Boosters, useBonusItem both instant Bonus
 * Items, and at least one fixture must replay to victory at Wave 50 under
 * a real Ruleset. A Tower kind that loses its fixture, or a fifty-Wave Run
 * that no longer wins, fails here before any digest is compared.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { classic, getRuleset, replayRun } from "../src/index.js";
import type { BoosterKind, InstantBonusItem, Run, TowerKind } from "../src/index.js";
import type { Fixture } from "./helpers/fixtures.js";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".fixture.ts"))
  .sort();

const fixtures: Fixture[] = [];
for (const file of files) {
  const mod = (await import(pathToFileURL(dir + file).href)) as { default: Fixture };
  fixtures.push(mod.default);
}

interface Inventory {
  readonly towers: Set<TowerKind>;
  readonly boosters: Set<BoosterKind>;
  readonly items: Set<InstantBonusItem>;
}

/** Kinds from accepted Commands only: a rejected placement exercises nothing. */
function inventoryOf(run: Run, into: Inventory): void {
  for (const { command, result } of run.log()) {
    if (!result.ok) continue;
    if (command.type === "placeTower") into.towers.add(command.kind);
    else if (command.type === "placeBooster") into.boosters.add(command.kind);
    else if (command.type === "useBonusItem") into.items.add(command.item);
  }
}

const built = fixtures.map((fixture) => ({ fixture, run: fixture.build() }));
const inventory: Inventory = { towers: new Set(), boosters: new Set(), items: new Set() };
for (const { run } of built) inventoryOf(run, inventory);

const ALL_BOOSTERS: readonly BoosterKind[] = ["damageBooster", "rangeBooster"];
const ALL_ITEMS: readonly InstantBonusItem[] = ["interestIncrease", "panic"];

describe("fixture inventory", () => {
  it("places every one of the twelve Classic Towers", () => {
    const classicKinds = classic.towers.map((t) => t.kind);
    expect(classicKinds).toHaveLength(12);
    expect([...inventory.towers].sort()).toEqual([...classicKinds].sort());
  });

  it("places both Boosters", () => {
    expect([...inventory.boosters].sort()).toEqual([...ALL_BOOSTERS].sort());
  });

  it("uses both instant Bonus Items", () => {
    expect([...inventory.items].sort()).toEqual([...ALL_ITEMS].sort());
  });

  it("includes a Run that replays to victory at Wave 50 under a shipped Ruleset", () => {
    const victories = built
      .map(({ fixture, run }) => ({ fixture, serialised: run.serialise() }))
      // A shipped Ruleset resolves through the registry; override Rulesets do not.
      .filter(({ serialised }) => getRuleset(serialised.rulesetId) !== undefined)
      .map(({ fixture, serialised }) => ({ name: fixture.name, replay: replayRun(serialised, fixture.resolver) }))
      .filter(({ replay }) => replay.outcome === "victory" && replay.snapshot.wave.current === 50);
    expect(victories.map((v) => v.name)).toContain("classic-fifty-waves-victory");
    for (const { replay } of victories) {
      expect(replay.snapshot.wave.total).toBe(50);
      expect(replay.snapshot.economy.lives).toBeGreaterThan(0);
      expect(replay.snapshot.vectoids).toHaveLength(0);
    }
  }, 60_000);
});
