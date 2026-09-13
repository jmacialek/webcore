/**
 * M1-02: Map text format and Switchback (#3).
 *
 * Every waypoint, Corridor Cell, Entry, and Exit below is taken from
 * docs/research/vector-td-maps.md section 2, "1. SWITCHBACK" (marker px / 25)
 * and section 3, "Grid facts" (22 x 18 Cells of 25 px).
 */
import { describe, expect, it } from "vitest";
import {
  GRID_COLS,
  GRID_ROWS,
  MapParseError,
  SWITCHBACK_TEXT,
  cellOf,
  cellsCrossed,
  getMap,
  isOnGrid,
  parseMap,
  switchback,
} from "../src/index.js";
import type { Cell, MapParseErrorCode, Point } from "../src/index.js";

/** Rewrite SWITCHBACK_TEXT line by line to build a malformed variant. */
function editLines(edit: (lines: string[]) => string[]): string {
  return edit(SWITCHBACK_TEXT.split("\n")).join("\n");
}

function replaceLine(startsWith: string, replacement: string | null): string {
  return editLines((lines) =>
    lines.flatMap((line) => {
      if (!line.startsWith(startsWith)) return [line];
      return replacement === null ? [] : [replacement];
    }),
  );
}

function expectParseError(text: string, code: MapParseErrorCode): void {
  let caught: unknown;
  try {
    parseMap(text);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(MapParseError);
  expect((caught as MapParseError).code).toBe(code);
}

function expectPoint(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
}

/** Research section 2, Switchback: lane A markers / 25. */
const LANE_0_WAYPOINTS: readonly Point[] = [
  { x: 1.6, y: -0.4 },
  { x: 1.6, y: 3.4 },
  { x: 19.6, y: 3.4 },
  { x: 19.6, y: 8.6 },
  { x: 14.4, y: 8.6 },
  { x: 14.4, y: 5.6 },
  { x: 1.6, y: 5.6 },
  { x: 1.6, y: 9.4 },
  { x: 10.4, y: 9.4 },
  { x: 10.4, y: 11.6 },
  { x: 1.6, y: 11.6 },
  { x: 1.6, y: 15.4 },
  { x: 14.4, y: 15.4 },
  { x: 14.4, y: 12.6 },
  { x: 17.6, y: 12.6 },
  { x: 17.6, y: 16.4 },
  { x: 22.4, y: 16.4 },
];

/** Research section 2, Switchback: lane B markers / 25. */
const LANE_1_WAYPOINTS: readonly Point[] = [
  { x: 2.4, y: -0.4 },
  { x: 2.4, y: 2.6 },
  { x: 20.4, y: 2.6 },
  { x: 20.4, y: 9.4 },
  { x: 13.6, y: 9.4 },
  { x: 13.6, y: 6.6 },
  { x: 2.6, y: 6.6 },
  { x: 2.6, y: 8.6 },
  { x: 11.4, y: 8.6 },
  { x: 11.4, y: 12.4 },
  { x: 2.6, y: 12.4 },
  { x: 2.6, y: 14.6 },
  { x: 13.6, y: 14.6 },
  { x: 13.6, y: 11.6 },
  { x: 18.4, y: 11.6 },
  { x: 18.4, y: 15.6 },
  { x: 22.4, y: 15.6 },
];

/**
 * Research section 2, Switchback ASCII sketch: A/B/# Cells are Corridor,
 * '.' is buildable. Transcribed independently of SWITCHBACK_TEXT so the
 * shipped Map is checked against the research, not against itself.
 */
const SKETCH = [
  ".AB...................",
  ".AB...................",
  ".ABBBBBBBBBBBBBBBBBBB.",
  ".AAAAAAAAAAAAAAAAAAAB.",
  "...................AB.",
  ".AAAAAAAAAAAAAA....AB.",
  ".ABBBBBBBBBBBBA....AB.",
  ".AB..........BA....AB.",
  ".ABBBBBBBBBB.BAAAAAAB.",
  ".AAAAAAAAAAB.BBBBBBBB.",
  "..........AB..........",
  ".AAAAAAAAAAB.BBBBBB...",
  ".ABBBBBBBBBB.BAAAAB...",
  ".AB..........BA..AB...",
  ".ABBBBBBBBBBBBA..AB...",
  ".AAAAAAAAAAAAAA..ABBBB",
  ".................AAAAA",
  "......................",
];

const sketchCorridor: Cell[] = [];
SKETCH.forEach((rowText, row) => {
  for (let col = 0; col < rowText.length; col += 1) {
    if (rowText.charAt(col) !== ".") sketchCorridor.push({ col, row });
  }
});

describe("Switchback matches the research sketch", () => {
  it("has 18 rows of 22 columns and 204 Corridor Cells", () => {
    expect(SKETCH).toHaveLength(GRID_ROWS);
    for (const rowText of SKETCH) expect(rowText).toHaveLength(GRID_COLS);
    expect(sketchCorridor).toHaveLength(204);
    expect(switchback.corridorCells).toHaveLength(204);
    expect(switchback.corridorCells).toEqual(sketchCorridor);
  });

  it("marks exactly the sketch Cells as Corridor and the rest buildable", () => {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const expected = SKETCH[row]?.[col] !== ".";
        expect(switchback.isCorridor({ col, row })).toBe(expected);
        expect(switchback.isBuildable({ col, row })).toBe(!expected);
      }
    }
  });

  it("exposes id, display name, tier easy, and Grid dimensions", () => {
    expect(switchback.id).toBe("switchback");
    expect(switchback.displayName).toBe("Switchback");
    expect(switchback.tier).toBe("easy");
    expect(switchback.cols).toBe(22);
    expect(switchback.rows).toBe(18);
  });

  it("has two Lanes of 17 waypoints each, in spawn order", () => {
    expect(switchback.lanes).toHaveLength(2);
    expect(switchback.lanes[0]?.index).toBe(0);
    expect(switchback.lanes[1]?.index).toBe(1);
    expect(switchback.lanes[0]?.waypoints).toEqual(LANE_0_WAYPOINTS);
    expect(switchback.lanes[1]?.waypoints).toEqual(LANE_1_WAYPOINTS);
  });

  it("Entry Cells are (1,0) and (2,0) on the top edge, Exits (21,16) and (21,15) on the right edge", () => {
    expect(switchback.lanes[0]?.entry).toEqual({ col: 1, row: 0 });
    expect(switchback.lanes[1]?.entry).toEqual({ col: 2, row: 0 });
    expect(switchback.lanes[0]?.exit).toEqual({ col: 21, row: 16 });
    expect(switchback.lanes[1]?.exit).toEqual({ col: 21, row: 15 });
  });

  it("Vectoids enter both Lanes travelling down from above (research spawnDir up)", () => {
    expect(switchback.lanes[0]?.entryDirection).toBe("up");
    expect(switchback.lanes[1]?.entryDirection).toBe("up");
  });

  it("every on-Grid waypoint of both Lanes lies in a Corridor Cell", () => {
    for (const lane of switchback.lanes) {
      for (const point of lane.waypoints) {
        const cell = cellOf(point);
        if (isOnGrid(cell)) expect(switchback.isCorridor(cell)).toBe(true);
      }
    }
  });
});

describe("Cell queries", () => {
  it("isCorridor and isBuildable are both false off-Grid", () => {
    const offGrid: Cell[] = [
      { col: -1, row: 0 },
      { col: 22, row: 0 },
      { col: 0, row: -1 },
      { col: 0, row: 18 },
    ];
    for (const cell of offGrid) {
      expect(switchback.isCorridor(cell)).toBe(false);
      expect(switchback.isBuildable(cell)).toBe(false);
      expect(isOnGrid(cell)).toBe(false);
    }
  });

  it("a Corridor Cell is not buildable and a buildable Cell is not Corridor", () => {
    expect(switchback.isCorridor({ col: 1, row: 0 })).toBe(true);
    expect(switchback.isBuildable({ col: 1, row: 0 })).toBe(false);
    expect(switchback.isCorridor({ col: 0, row: 0 })).toBe(false);
    expect(switchback.isBuildable({ col: 0, row: 0 })).toBe(true);
  });

  it("cellOf floors a point to its Cell (one px is 1/25 Cell)", () => {
    expect(cellOf({ x: 1.6, y: 3.4 })).toEqual({ col: 1, row: 3 });
    expect(cellOf({ x: 22.4, y: 16.4 })).toEqual({ col: 22, row: 16 });
    expect(cellOf({ x: -0.4, y: 0 })).toEqual({ col: -1, row: 0 });
  });
});

describe("Lane geometry", () => {
  // Lane 0's axis-aligned segments, hand-summed from the research markers:
  // 3.8+18+5.2+5.2+3+12.8+3.8+8.8+2.2+8.8+3.8+12.8+2.8+3.2+3.8+4.8
  const LANE_0_LENGTH = 102.8;

  it("length of Lane 0 equals the hand-computed sum of its segments", () => {
    expect(switchback.lanes[0]?.length).toBeCloseTo(LANE_0_LENGTH, 10);
  });

  it("positionAt walks the first segment", () => {
    const lane = switchback.lanes[0];
    if (!lane) throw new Error("missing Lane 0");
    expectPoint(lane.positionAt(0), { x: 1.6, y: -0.4 });
    expectPoint(lane.positionAt(2), { x: 1.6, y: 1.6 });
  });

  it("positionAt lands exactly on a waypoint at its cumulative distance", () => {
    const lane = switchback.lanes[0];
    if (!lane) throw new Error("missing Lane 0");
    expectPoint(lane.positionAt(3.8), { x: 1.6, y: 3.4 });
    expectPoint(lane.positionAt(21.8), { x: 19.6, y: 3.4 });
  });

  it("positionAt walks a later segment", () => {
    const lane = switchback.lanes[0];
    if (!lane) throw new Error("missing Lane 0");
    // 21.8 to the third waypoint, then 5 Cells down the third segment.
    expectPoint(lane.positionAt(26.8), { x: 19.6, y: 8.4 });
  });

  it("positionAt extrapolates backwards for a negative distance (the spawn queue)", () => {
    const lane = switchback.lanes[0];
    if (!lane) throw new Error("missing Lane 0");
    expectPoint(lane.positionAt(-1), { x: 1.6, y: -1.4 });
  });

  it("positionAt clamps to the last waypoint beyond the Lane's length", () => {
    const lane = switchback.lanes[0];
    if (!lane) throw new Error("missing Lane 0");
    expectPoint(lane.positionAt(LANE_0_LENGTH + 50), { x: 22.4, y: 16.4 });
    expectPoint(lane.positionAt(LANE_0_LENGTH), { x: 22.4, y: 16.4 });
  });
});

describe("parseMap rejects malformed Maps with a specific code", () => {
  it("accepts SWITCHBACK_TEXT and yields the same Map as the built-in", () => {
    const parsed = parseMap(SWITCHBACK_TEXT);
    expect(parsed.corridorCells).toEqual(switchback.corridorCells);
    expect(parsed.lanes.map((lane) => lane.waypoints)).toEqual(
      switchback.lanes.map((lane) => lane.waypoints),
    );
  });

  it("laneWaypointOutsideCorridor: an on-Grid waypoint in a buildable Cell", () => {
    // Cell (1,4) is buildable in the sketch (row 4 is "...................AB.").
    expectParseError(
      replaceLine("lane 0 ", "lane 0 1.6,-0.4 1.6,4.4 22.4,4.4"),
      "laneWaypointOutsideCorridor",
    );
  });

  it("badGridSize: 17 rows", () => {
    expectParseError(replaceLine("......................", null), "badGridSize");
  });

  it("badGridSize: a row of 21 columns", () => {
    expectParseError(
      replaceLine("......................", "....................."),
      "badGridSize",
    );
  });

  it("badGridCharacter: a character other than # or .", () => {
    expectParseError(
      replaceLine("......................", "..........x..........."),
      "badGridCharacter",
    );
  });

  it("missingLane: only one Lane", () => {
    expectParseError(replaceLine("lane 1 ", null), "missingLane");
  });

  it("tooManyLanes: a third Lane", () => {
    expectParseError(
      editLines((lines) => [...lines, "lane 2 1.6,-0.4 1.6,3.4 22.4,3.4"]),
      "tooManyLanes",
    );
  });

  it("laneEntryNotOffGrid: first waypoint inside the Grid", () => {
    expectParseError(
      replaceLine("lane 0 ", "lane 0 1.6,0.4 1.6,3.4 22.4,3.4"),
      "laneEntryNotOffGrid",
    );
  });

  it("laneExitNotOffGrid: last waypoint inside the Grid", () => {
    expectParseError(
      replaceLine("lane 0 ", "lane 0 1.6,-0.4 1.6,3.4 19.6,3.4"),
      "laneExitNotOffGrid",
    );
  });

  it("laneTooShort: a single waypoint", () => {
    expectParseError(replaceLine("lane 0 ", "lane 0 1.6,-0.4"), "laneTooShort");
  });

  it("badWaypoint: an unparseable coordinate", () => {
    expectParseError(
      replaceLine("lane 0 ", "lane 0 1.6,-0.4 1.6,abc 22.4,3.4"),
      "badWaypoint",
    );
  });

  it("badTier: a tier outside easy|normal|hard", () => {
    expectParseError(replaceLine("tier ", "tier brutal"), "badTier");
  });

  it("badEntryDirection: a direction outside up|down|left|right", () => {
    expectParseError(replaceLine("entry 0 ", "entry 0 sideways"), "badEntryDirection");
  });

  it("missingHeader: no id, no name, no tier, no grid, or no entry line", () => {
    expectParseError(replaceLine("id ", null), "missingHeader");
    expectParseError(replaceLine("name ", null), "missingHeader");
    expectParseError(replaceLine("tier ", null), "missingHeader");
    expectParseError(replaceLine("grid", null), "missingHeader");
    expectParseError(replaceLine("entry 1 ", null), "missingHeader");
  });

  it("ignores comment and blank lines outside the grid block", () => {
    const parsed = parseMap(`# a comment\n\n${SWITCHBACK_TEXT}\n# trailing\n`);
    expect(parsed.id).toBe("switchback");
  });

  it("a comment inside the grid block (a '#' line with a space) does not end the block", () => {
    const text = editLines((lines) => {
      const grid = lines.indexOf("grid");
      return [...lines.slice(0, grid + 1), "# grid comment", ...lines.slice(grid + 1, grid + 10), "# another, mid-grid", ...lines.slice(grid + 10)];
    });
    expect(parseMap(text).corridorCells).toEqual(switchback.corridorCells);
  });

  it("laneSegmentOutsideCorridor: a buildable Cell between two waypoints", () => {
    // Row 3 is ".####################."; Cell (5,3) lies under Lane 0's segment from 1.6,3.4 to 19.6,3.4.
    const text = editLines((lines) => {
      const row = lines.indexOf("grid") + 1 + 3;
      const line = lines[row] ?? "";
      lines[row] = `${line.slice(0, 5)}.${line.slice(6)}`;
      return lines;
    });
    expectParseError(text, "laneSegmentOutsideCorridor");
  });
});

describe("cellsCrossed lists every on-Grid Cell a segment passes through", () => {
  it("an axis-aligned segment: Lane 0's first segment covers (1,0) to (1,3)", () => {
    expect(cellsCrossed({ x: 1.6, y: -0.4 }, { x: 1.6, y: 3.4 })).toEqual([
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ]);
  });

  it("a leftward segment lists Cells in travel order", () => {
    expect(cellsCrossed({ x: 3.5, y: 8.6 }, { x: 0.5, y: 8.6 })).toEqual([
      { col: 3, row: 8 },
      { col: 2, row: 8 },
      { col: 1, row: 8 },
      { col: 0, row: 8 },
    ]);
  });

  it("a diagonal segment steps through both axes", () => {
    expect(cellsCrossed({ x: 0.5, y: 0.5 }, { x: 2.5, y: 1.5 })).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ]);
  });

  it("segment endpoints on Grid lines belong to their floor-assigned Cell in either direction", () => {
    expect(cellsCrossed({ x: 0.5, y: 0.5 }, { x: 2, y: 0.5 })).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ]);
    expect(cellsCrossed({ x: 2, y: 0.5 }, { x: 0.5, y: 0.5 })).toEqual([
      { col: 2, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 0 },
    ]);
  });

  it("a segment entirely off the Grid crosses nothing", () => {
    expect(cellsCrossed({ x: -3, y: -3 }, { x: -1, y: -1 })).toEqual([]);
  });

  it("every Cell under both Switchback Lanes is Corridor", () => {
    for (const lane of switchback.lanes) {
      for (let i = 0; i + 1 < lane.waypoints.length; i += 1) {
        const a = lane.waypoints[i];
        const b = lane.waypoints[i + 1];
        if (a === undefined || b === undefined) throw new Error("missing waypoint");
        for (const cell of cellsCrossed(a, b)) expect(switchback.isCorridor(cell)).toBe(true);
      }
    }
  });
});

describe("getMap registry", () => {
  it("returns Switchback for its id", () => {
    expect(getMap("switchback")).toBe(switchback);
  });

  it("returns undefined for an unknown id", () => {
    expect(getMap("no-such-map")).toBeUndefined();
  });
});
