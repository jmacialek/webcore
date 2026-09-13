/**
 * M1-17: the balancing harness plays a checked-in build order headlessly.
 * A smoke test only: it asserts the harness completes and reports, never
 * the balance numbers themselves (those are M1-18's to tune).
 */
import { describe, expect, it } from "vitest";
import { buildOrders } from "../harness/build-orders/index.js";
import { formatReport, runHarness } from "../harness/harness.js";

describe("balancing harness (M1-17)", () => {
  it("runs frost-rockets under Classic to a capped tick, reporting at least one Wave row", () => {
    const buildOrder = buildOrders["frost-rockets"];
    expect(buildOrder).toBeDefined();
    if (buildOrder === undefined) return;
    const result = runHarness(buildOrder, { ruleset: "classic", seed: 1, tickCap: 20 * 120 });
    expect(result.rulesetId).toBe("classic");
    expect(result.mapId).toBe("switchback");
    expect(result.waves.length).toBeGreaterThanOrEqual(1);
    expect(result.waves[0]).toMatchObject({ wave: 1, sentTick: 0 });
    expect(result.outcome !== null || result.capReached).toBe(true);
    expect(result.ticks).toBeLessThanOrEqual(20 * 120);
    const report = formatReport(result);
    expect(report.some((line) => line.startsWith("Wave"))).toBe(true);
    expect(report.at(-1)).toMatch(/^Outcome: /);
  });

  it("reports a rejected Command as a warning instead of throwing", () => {
    const result = runHarness(
      { name: "rejects", description: "", ruleset: "classic", steps: [{ wave: 0, commands: [{ type: "upgrade", towerId: 99 }] }] },
      { tickCap: 10 },
    );
    expect(result.rejected).toEqual([{ wave: 0, tick: 0, command: { type: "upgrade", towerId: 99 }, reason: "noSuchTower" }]);
    expect(formatReport(result).some((line) => line.startsWith("warning:") && line.endsWith("noSuchTower"))).toBe(true);
  });

  it("every checked-in build order is registered under its own name", () => {
    for (const [name, buildOrder] of Object.entries(buildOrders)) expect(buildOrder.name).toBe(name);
  });
});
