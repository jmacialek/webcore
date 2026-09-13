import { classic, getTowerSpec, switchback } from "../../src/index.js";
import type { Cell, Run, TowerKind } from "../../src/index.js";
import { defineFixture } from "../helpers/fixtures.js";
import { must } from "../helpers/run.js";

/**
 * M1-16: a complete Classic Run on Switchback that wins all fifty Waves
 * under the real numbers (no Ruleset override): $275 start Bank, 20 Lives,
 * 3% Interest (waves research 1.2, 2, 4). This is the engine's first real
 * balance test, so the build order is data and the loop below is the whole
 * "player".
 *
 * The strategy is the one the original rewards: Interest is paid on the
 * whole Bank at every Send (waves research 2), and every Bonus Point buys
 * +3 points of Interest (towers research 1.4), so the Bank is left to
 * compound and only the cheapest defence that holds is bought.
 *
 *  - Waves 1..14: four Red Refractors on rows 4 and 7, each Ranked to 10.
 *    Those rows sit between two Corridor double-rows, so a Tower there sees
 *    both Lanes four times per lap, and the Refractor's 2-Cell splash
 *    (towers research 1.3) hits the whole 0.8-Cell-spaced stream.
 *  - Waves 24 and 30: one Blue Frost Rockets each at Rank 1 (the splash
 *    slow does not grow with Rank, and 150% to the 22 Blue Spinner Waves),
 *    Ranked to 10 only from Wave 40 once the Bank is ahead.
 *  - Waves 28 and 34: one Red Rockets each, Ranked to 10: the damage the
 *    Frost's slow sets up (ADR 0001 item 2, M1-18).
 *  - Wave 42: ten Red Rockets on the four golden rows, placed at Rank 1
 *    first for coverage, then Ranked to 10 from Wave 48 as the Bank
 *    allows. Wave 50's Bonus Point buys Panic, the one instant Bonus Item
 *    still worth anything.
 *
 * Sends are eager (whenever `canSend`), so Waves overlap and the Run ends in
 * about 135,000 ticks with 17 Lives left. Any Bounty, Interest, upgrade,
 * or targeting drift changes the Command Log and the digests. Replaying
 * takes a couple of seconds because every tick is digested; the sim
 * project's `testTimeout` allows for it.
 */

/** One line of the build order, unlocked once Wave `fromWave` has been Sent. */
type Purchase =
  | { readonly fromWave: number; readonly place: TowerKind; readonly cell: Cell }
  | { readonly fromWave: number; readonly upgrade: number }
  | { readonly fromWave: number; readonly upgradeToMax: number };

/** Cells for the ten late Red Rockets (Towers 9..18), on the four golden rows. */
const RED_ROCKET_CELLS: readonly Cell[] = [
  { col: 9, row: 10 },
  { col: 6, row: 10 },
  { col: 6, row: 13 },
  { col: 16, row: 10 },
  { col: 16, row: 13 },
  { col: 15, row: 7 },
  { col: 2, row: 10 },
  { col: 0, row: 13 },
  { col: 6, row: 4 },
  { col: 12, row: 10 },
];

/** Tower ids are 1-based in placement order (Refractors 1..4, Frost Rockets 5 and 7, Red Rockets 6 and 8, then Red Rockets 9..18). */
const BUILD_ORDER: readonly Purchase[] = [
  { fromWave: 0, place: "redRefractor", cell: { col: 8, row: 4 } }, // Tower 1: $200 (towers research 1.1)
  { fromWave: 0, upgrade: 1 }, // each Rank int(200 / 2) = $100 (towers research 1.2)
  { fromWave: 0, upgrade: 1 },
  { fromWave: 0, upgrade: 1 },
  { fromWave: 0, place: "redRefractor", cell: { col: 8, row: 7 } }, // Tower 2
  { fromWave: 0, upgradeToMax: 1 },
  { fromWave: 0, upgradeToMax: 2 },
  { fromWave: 0, place: "redRefractor", cell: { col: 12, row: 4 } }, // Tower 3
  { fromWave: 0, upgradeToMax: 3 },
  { fromWave: 0, place: "redRefractor", cell: { col: 12, row: 7 } }, // Tower 4
  { fromWave: 0, upgradeToMax: 4 },
  { fromWave: 24, place: "blueFrostRockets", cell: { col: 14, row: 4 } }, // Tower 5: $2,200 (Classic, ADR 0001 item 2)
  { fromWave: 28, place: "redRockets", cell: { col: 16, row: 7 } }, // Tower 6: $2,500 + 9 x $1,250 (towers research 1.1, 1.2)
  { fromWave: 28, upgradeToMax: 6 },
  { fromWave: 30, place: "blueFrostRockets", cell: { col: 10, row: 7 } }, // Tower 7
  { fromWave: 34, place: "redRockets", cell: { col: 15, row: 4 } }, // Tower 8
  { fromWave: 34, upgradeToMax: 8 },
  // Wave 40: the Frost Rockets' Ranks (9 x $1,100 each), now that the Bank is ahead of the Waves.
  { fromWave: 40, upgradeToMax: 5 },
  { fromWave: 40, upgradeToMax: 7 },
  // Wave 42: ten Red Rockets at Rank 1 on the four golden rows, for coverage first.
  ...RED_ROCKET_CELLS.map((cell): Purchase => ({ fromWave: 42, place: "redRockets", cell })),
  // Wave 48: their Ranks, in placement order.
  ...RED_ROCKET_CELLS.map((_, i): Purchase => ({ fromWave: 48, upgradeToMax: 9 + i })),
];

/** Well above the ~135,000 ticks the Run needs; a regression that stalls the Run fails here instead of hanging. */
const MAX_TICKS = 200_000;

/** True when the next line of the build order is unlocked and the Bank covers it in full. */
function canBuy(run: Run, purchase: Purchase): boolean {
  const snapshot = run.snapshot();
  if (snapshot.wave.current < purchase.fromWave) return false;
  if ("place" in purchase) {
    const spec = getTowerSpec(classic, purchase.place);
    if (spec === undefined) throw new Error(`Classic has no ${purchase.place}`);
    return snapshot.economy.bank >= spec.cost;
  }
  const tower = snapshot.towers.find((t) => t.id === ("upgrade" in purchase ? purchase.upgrade : purchase.upgradeToMax));
  if (tower === undefined) throw new Error("build order names a Tower that is not placed yet");
  if ("upgrade" in purchase) return tower.upgradeCost !== null && snapshot.economy.bank >= tower.upgradeCost;
  // Max Upgrade only once it reaches Rank 10 (towers research 1.2: level max 10), never a partial one.
  return tower.rank + tower.maxUpgrade.ranks === classic.upgrade.maxRank;
}

function buy(run: Run, purchase: Purchase): void {
  if ("place" in purchase) must(run, { type: "placeTower", kind: purchase.place, cell: purchase.cell });
  else if ("upgrade" in purchase) must(run, { type: "upgrade", towerId: purchase.upgrade });
  else must(run, { type: "upgradeToMax", towerId: purchase.upgradeToMax });
}

export default defineFixture("classic-fifty-waves-victory", (createRun) => {
  const run = createRun({ ruleset: classic, map: switchback, seed: 1 });
  let next = 0;
  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    const snapshot = run.snapshot();
    if (snapshot.outcome !== null) return run;
    // Every Bonus Point goes on Interest Increase the tick it is earned (towers research 1.4),
    // except Wave 50's: no Send remains to pay Interest, so it buys Panic (+5 Lives) instead.
    for (let points = snapshot.economy.bonusPoints; points > 0; points -= 1) {
      must(run, { type: "useBonusItem", item: snapshot.wave.next === null ? "panic" : "interestIncrease" });
    }
    while (next < BUILD_ORDER.length) {
      const purchase = BUILD_ORDER[next];
      if (purchase === undefined || !canBuy(run, purchase)) break;
      buy(run, purchase);
      next += 1;
    }
    // Eager Send: as soon as no more than 10 Vectoids are alive (waves research 2).
    if (run.snapshot().wave.canSend) must(run, { type: "sendWave" });
    run.step();
  }
  throw new Error(`the fifty-Wave Run did not end within ${String(MAX_TICKS)} ticks`);
});
