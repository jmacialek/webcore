import { describe, expect, it } from "vitest";
import { cellOf, cellsCrossed, classic, createRun, GRID_COLS, GRID_ROWS, parseMap, replayRun, switchback } from "../src/index.js";
import type { Cell, Command, Point, SerialisedRun } from "../src/index.js";
import { stepTicks } from "./helpers/run.js";

const fresh = () => createRun({ ruleset: classic, map: switchback, seed: 1 });

describe("CommandResult ownership", () => {
  it.each(["apply", "log"] as const)("mutating a success from %s preserves both Runs and their replays", (boundary) => {
    const run = fresh();
    const other = fresh();
    const command: Command = { type: "placeTower", tick: 0, kind: "greenLaser1", cell: { col: 0, row: 0 } };
    const applied = run.apply(command);
    other.apply(command);
    const exposed = boundary === "apply" ? applied : run.log()[0]?.result;
    if (exposed === undefined) throw new Error("missing result");
    Object.assign(exposed, { ok: false, reason: "outOfOrderTick" });
    try {
      expect(run.apply({ type: "setAuto", tick: 0, enabled: true })).toEqual({ ok: true });
      expect(other.apply({ type: "setAuto", tick: 0, enabled: true })).toEqual({ ok: true });
      for (const live of [run, other, fresh()]) {
        expect(live.apply({ type: "setAuto", tick: 0, enabled: true })).toEqual({ ok: true });
        expect(live.log().every((entry) => entry.result.ok)).toBe(true);
        stepTicks(live, 3);
        const replay = replayRun(live.serialise());
        expect(replay.results).toEqual(live.log().map((entry) => entry.result));
        expect(replay.snapshot).toEqual(live.snapshot());
        expect(replay.finalDigest).toBe(live.digest());
      }
    } finally {
      // Keep a failure against the old shared singleton from poisoning other tests.
      Object.assign(exposed, { ok: true });
      Reflect.deleteProperty(exposed, "reason");
    }
  });

  it.each(["apply", "log"] as const)("mutating a rejection from %s cannot rewrite the retained result", (boundary) => {
    const run = fresh();
    const applied = run.apply({ type: "sell", tick: 0, towerId: 1 });
    const exposed = boundary === "apply" ? applied : run.log()[0]?.result;
    if (exposed === undefined) throw new Error("missing result");
    Object.assign(exposed, { ok: true });
    expect(run.log()[0]?.result).toEqual({ ok: false, reason: "noSuchTower" });
    expect(replayRun(run.serialise()).results).toEqual(run.log().map((entry) => entry.result));
  });
});

describe("replay validates raw entries before scheduling", () => {
  const malformed: readonly [string, unknown][] = [
    ["null", null], ["number", 42], ["boolean", false], ["string", "sendWave"], ["array", []],
    ["missing fields", {}], ["missing tick", { type: "sendWave" }],
    ["string tick", { type: "sendWave", tick: "3" }],
    ["fractional tick", { type: "sendWave", tick: 3.5 }],
    ["unknown type with future tick", { type: "unknown", tick: 100 }],
    ["mistyped payload with future tick", { type: "setAuto", tick: 100, enabled: "false" }],
    ["missing Cell with future tick", { type: "placeTower", tick: 100, kind: "greenLaser1" }],
  ];
  it.each(malformed)("rejects %s without changing timing or command order", (_name, raw) => {
    const commands: readonly Command[] = [
      { type: "sendWave", tick: 0 },
      { type: "setAuto", tick: 2, enabled: true },
      { type: "setAuto", tick: 2, enabled: false },
      { type: "sendWave", tick: 1 },
    ];
    const clean = { ...fresh().serialise(), commands, ticks: 4 };
    // JSON is the public replay input boundary; its static type cannot validate its contents.
    const input = JSON.parse(JSON.stringify({ ...clean, commands: [commands[0], raw, ...commands.slice(1)] })) as SerialisedRun;
    const expected = replayRun(clean);
    const actual = replayRun(input);
    expect(actual.results).toEqual([expected.results[0], { ok: false, reason: "malformedCommand" }, ...expected.results.slice(1)]);
    expect(actual.snapshot).toEqual(expected.snapshot);
    expect(actual.tickDigests).toEqual(expected.tickDigests);
    expect(actual.tickEventDigests).toEqual(expected.tickEventDigests);
    expect(actual.rollingDigest).toBe(expected.rollingDigest);
  });
});

function cornerMap(lane: string, buildable?: Cell): string {
  const rows = Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) => buildable?.col === col && buildable.row === row ? "." : "#").join(""));
  return ["id corner", "name Corner", "tier easy", "entry 0 up", "entry 1 up", "grid", ...rows,
    `lane 0 ${lane}`, "lane 1 10.5,-0.5 10.5,18.5"].join("\n");
}

describe("Lane containment follows floor semantics at exact points", () => {
  it("rejects a buildable Cell at the exact mixed-direction diagonal crossing", () => {
    const lane = "3.5,-1 -2.5,7";
    const map = parseMap(cornerMap(lane));
    expect(map.lanes[0]?.positionAt(2.5)).toEqual({ x: 2, y: 1 });
    expect(() => parseMap(cornerMap(lane, { col: 2, row: 1 }))).toThrow(expect.objectContaining({ code: "laneSegmentOutsideCorridor" }));
  });

  it("prevents the tick 93 Tower / tick 94 Vectoid overlap at unmodified Classic speed", () => {
    const lane = "2.7520000000000002,-0.002666666666667039 -5.520000000000001,11.02666666666667";
    const map = parseMap(cornerMap(lane));
    const run = createRun({ ruleset: classic, map, seed: 1 });
    expect(run.apply({ type: "sendWave", tick: 0 })).toEqual({ ok: true });
    stepTicks(run, 93);
    expect(run.apply({ type: "placeTower", tick: 93, kind: "greenLaser1", cell: { col: 2, row: 1 } })).toEqual({ ok: false, reason: "cellIsCorridor" });
    run.step();
    const lead = run.snapshot().vectoids.find((v) => v.id === 1);
    expect(lead).toMatchObject({ x: 2, y: 1 });
    if (lead === undefined) throw new Error("missing Vectoid");
    expect(map.isCorridor(cellOf(lead))).toBe(true);
    expect(() => parseMap(cornerMap(lane, { col: 2, row: 1 }))).toThrow(expect.objectContaining({ code: "laneSegmentOutsideCorridor" }));
  });

  it("includes Cells reached by floating-point rounding beside a corner", () => {
    const a = { x: 4.989279614737255, y: 6.482222820373792 };
    const b = { x: 5.2013812297712985, y: 16.726386004334856 };
    const t = 0.050543628633022294;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    expect(point).toEqual({ x: 5, y: 6.999999999999999 });
    expect(cellsCrossed(a, b)).toContainEqual(cellOf(point));
    // Put the segment inside a complete Lane so Map validation exercises it too.
    const lane = `4.5,-1 ${String(a.x)},${String(a.y)} ${String(b.x)},${String(b.y)} 5.5,19`;
    expect(() => parseMap(cornerMap(lane, { col: 5, row: 6 }))).toThrow(expect.objectContaining({ code: "laneSegmentOutsideCorridor" }));
  });

  it.each([
    [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }, [{ col: 0, row: 0 }, { col: 1, row: 1 }]],
    [{ x: 1.5, y: 1.5 }, { x: 0.5, y: 0.5 }, [{ col: 1, row: 1 }, { col: 0, row: 0 }]],
    [{ x: 0.5, y: 1.5 }, { x: 1.5, y: 0.5 }, [{ col: 0, row: 1 }, { col: 1, row: 1 }, { col: 1, row: 0 }]],
    [{ x: 1.5, y: 0.5 }, { x: 0.5, y: 1.5 }, [{ col: 1, row: 0 }, { col: 1, row: 1 }, { col: 0, row: 1 }]],
  ] satisfies [Point, Point, Cell[]][])("includes only floor-assigned Cells from %j to %j", (a, b, expected) => {
    expect(cellsCrossed(a, b)).toEqual(expected);
  });

  it.each(["22,-1 22,19", "-1,18 23,18", "-1,17 1,19", "21,-1 23,1"])(
    "rejects a Lane that only touches excluded Grid edges: %s", (lane) => {
      expect(() => parseMap(cornerMap(lane))).toThrow(expect.objectContaining({ code: "laneWaypointOutsideCorridor" }));
    },
  );

  it("a Lane touching only the included Grid corner has that Cell as Entry and Exit", () => {
    const map = parseMap(cornerMap("-1,1 1,-1"));
    expect(map.lanes[0]).toMatchObject({ entry: { col: 0, row: 0 }, exit: { col: 0, row: 0 } });
    expect(() => parseMap(cornerMap("-1,1 1,-1", { col: 0, row: 0 }))).toThrow(expect.objectContaining({ code: "laneSegmentOutsideCorridor" }));
  });

  it.each([
    [{ x: -1, y: 1 }, { x: 1, y: -1 }, [{ col: 0, row: 0 }]],
    [{ x: -1, y: 17 }, { x: 1, y: 19 }, []],
    [{ x: 21, y: -1 }, { x: 23, y: 1 }, []],
    [{ x: 0, y: -1 }, { x: 0, y: 1 }, [{ col: 0, row: 0 }, { col: 0, row: 1 }]],
    [{ x: -1, y: 0 }, { x: 1, y: 0 }, [{ col: 0, row: 0 }, { col: 1, row: 0 }]],
    [{ x: 22, y: -1 }, { x: 22, y: 19 }, []],
    [{ x: -1, y: 18 }, { x: 23, y: 18 }, []],
  ] satisfies [Point, Point, Cell[]][])("uses half-open Grid boundaries from %j to %j", (a, b, expected) => {
    expect(cellsCrossed(a, b)).toEqual(expected);
    expect(cellsCrossed(b, a)).toEqual([...expected].reverse());
  });
});
