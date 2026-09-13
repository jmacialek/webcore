/**
 * Map text format (CONTEXT.md: Map, Grid, Cell, Corridor, Lane, Entry).
 *
 * ```
 * # comments start with '#', blank lines are ignored
 * id switchback
 * name Switchback
 * tier easy
 * entry 0 up
 * entry 1 up
 * grid
 * .##...................        18 rows of exactly 22 characters:
 * ...                            '#' = Corridor Cell, '.' = buildable Cell
 * lane 0 1.6,-0.4 1.6,3.4 ...   waypoints as x,y in Cells
 * lane 1 2.4,-0.4 2.4,2.6 ...
 * ```
 *
 * The grid block runs from the `grid` line until the next directive line;
 * inside it every whitespace-free line is a row, so a row may begin with
 * '#'. Comments inside the grid block must contain a space (`# like this`)
 * and do not end the block. Directives may otherwise appear in any order;
 * a repeated header keeps its last value.
 *
 * Every Lane must stay inside the Corridor for its whole on-Grid length:
 * not only its waypoints but every Cell a segment crosses, or a Tower could
 * be built on a Cell Vectoids walk through.
 */
import { createLane, cellOf, cellsCrossed, gridCrossing, isOnGrid } from "./lane.js";
import { GRID_COLS, GRID_ROWS, MapParseError } from "./types.js";
import type {
  Cell,
  EntryDirection,
  GameMap,
  Lane,
  MapParseErrorCode,
  MapTier,
  Point,
} from "./types.js";

const LANE_COUNT = 2;
const TIERS: readonly MapTier[] = ["easy", "normal", "hard"];
const DIRECTIONS: readonly EntryDirection[] = ["up", "down", "left", "right"];
const DIRECTIVES: ReadonlySet<string> = new Set(["id", "name", "tier", "entry", "grid", "lane"]);
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const INTEGER = /^\d+$/;

function fail(code: MapParseErrorCode, message: string): never {
  throw new MapParseError(code, message);
}

function isTier(value: string): value is MapTier {
  return (TIERS as readonly string[]).includes(value);
}

function isDirection(value: string): value is EntryDirection {
  return (DIRECTIONS as readonly string[]).includes(value);
}

interface LaneLine {
  readonly lineNo: number;
  readonly tokens: readonly string[];
}

interface Header {
  id: string | undefined;
  name: string | undefined;
  tier: string | undefined;
  gridSeen: boolean;
  readonly gridRows: string[];
  readonly entries: Map<number, EntryDirection>;
  readonly laneLines: Map<number, LaneLine>;
}

function parseLaneIndex(token: string | undefined, lineNo: number, what: string): number {
  const at = `line ${String(lineNo)}`;
  if (token === undefined || !INTEGER.test(token)) {
    fail("missingLane", `${at}: ${what} needs a Lane index of 0 or 1`);
  }
  const index = Number(token);
  if (index >= LANE_COUNT) {
    fail("tooManyLanes", `${at}: Lane index ${token} but a Map has exactly ${String(LANE_COUNT)} Lanes`);
  }
  return index;
}

function readLines(text: string): Header {
  const header: Header = {
    id: undefined,
    name: undefined,
    tier: undefined,
    gridSeen: false,
    gridRows: [],
    entries: new Map(),
    laneLines: new Map(),
  };
  let inGrid = false;
  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n += 1) {
    const lineNo = n + 1;
    const line = (lines[n] ?? "").trim();
    if (line === "") continue;
    const tokens = line.split(/\s+/);
    const keyword = tokens[0] ?? "";
    if (inGrid && tokens.length === 1 && !DIRECTIVES.has(keyword)) {
      header.gridRows.push(line);
      continue;
    }
    // A comment (a '#' line with whitespace in it) never ends the grid block.
    if (line.startsWith("#")) continue;
    inGrid = false;
    const rest = tokens.slice(1).join(" ");
    const at = `line ${String(lineNo)}`;
    switch (keyword) {
      case "id":
        header.id = rest;
        break;
      case "name":
        header.name = rest;
        break;
      case "tier":
        header.tier = rest;
        break;
      case "grid":
        header.gridSeen = true;
        inGrid = true;
        break;
      case "entry": {
        const direction = tokens[2] ?? "";
        if (tokens.length !== 3 || !INTEGER.test(tokens[1] ?? "")) {
          fail("badEntryDirection", `${at}: expected "entry <laneIndex> <up|down|left|right>"`);
        }
        if (!isDirection(direction)) {
          fail("badEntryDirection", `${at}: entry direction "${direction}" is not up, down, left, or right`);
        }
        header.entries.set(Number(tokens[1]), direction);
        break;
      }
      case "lane": {
        const index = parseLaneIndex(tokens[1], lineNo, "lane");
        if (header.laneLines.has(index)) {
          fail("tooManyLanes", `${at}: Lane ${String(index)} is defined twice`);
        }
        header.laneLines.set(index, { lineNo, tokens: tokens.slice(2) });
        break;
      }
      default:
        fail("missingHeader", `${at}: unknown directive "${keyword}"`);
    }
  }
  return header;
}

function parseGrid(rows: readonly string[]): boolean[] {
  if (rows.length !== GRID_ROWS) {
    fail("badGridSize", `grid has ${String(rows.length)} rows, expected ${String(GRID_ROWS)}`);
  }
  const corridor: boolean[] = [];
  rows.forEach((row, r) => {
    if (row.length !== GRID_COLS) {
      fail("badGridSize", `grid row ${String(r)} has ${String(row.length)} columns, expected ${String(GRID_COLS)}`);
    }
    for (const ch of row) {
      if (ch !== "#" && ch !== ".") {
        fail("badGridCharacter", `grid row ${String(r)}: "${ch}" is not '#' or '.'`);
      }
      corridor.push(ch === "#");
    }
  });
  return corridor;
}

function parseWaypoint(token: string, lineNo: number): Point {
  const parts = token.split(",");
  const [xText, yText] = parts;
  if (parts.length !== 2 || xText === undefined || yText === undefined || !NUMBER.test(xText) || !NUMBER.test(yText)) {
    fail("badWaypoint", `line ${String(lineNo)}: waypoint "${token}" is not "x,y"`);
  }
  return { x: Number(xText), y: Number(yText) };
}

function parseLane(
  index: number,
  laneLine: LaneLine,
  entryDirection: EntryDirection,
  isCorridor: (cell: Cell) => boolean,
): Lane {
  const at = `Lane ${String(index)} (line ${String(laneLine.lineNo)})`;
  const waypoints = laneLine.tokens.map((token) => parseWaypoint(token, laneLine.lineNo));
  if (waypoints.length < 2) {
    fail("laneTooShort", `${at}: needs at least two waypoints`);
  }
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (first !== undefined && isOnGrid(cellOf(first))) {
    fail("laneEntryNotOffGrid", `${at}: first waypoint ${String(first.x)},${String(first.y)} must be off-Grid`);
  }
  if (last !== undefined && isOnGrid(cellOf(last))) {
    fail("laneExitNotOffGrid", `${at}: last waypoint ${String(last.x)},${String(last.y)} must be off-Grid`);
  }
  waypoints.forEach((point, i) => {
    const prev = waypoints[i - 1];
    if (prev?.x === point.x && prev.y === point.y) {
      fail("badWaypoint", `${at}: waypoint ${String(i)} repeats waypoint ${String(i - 1)}`);
    }
    const cell = cellOf(point);
    if (isOnGrid(cell) && !isCorridor(cell)) {
      fail(
        "laneWaypointOutsideCorridor",
        `${at}: waypoint ${String(point.x)},${String(point.y)} lies in buildable Cell (${String(cell.col)},${String(cell.row)})`,
      );
    }
  });
  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a === undefined || b === undefined) break;
    for (const cell of cellsCrossed(a, b)) {
      if (!isCorridor(cell)) {
        fail(
          "laneSegmentOutsideCorridor",
          `${at}: segment ${String(i)} from ${String(a.x)},${String(a.y)} to ${String(b.x)},${String(b.y)} crosses buildable Cell (${String(cell.col)},${String(cell.row)})`,
        );
      }
    }
  }
  const crossing = gridCrossing(waypoints);
  if (crossing === undefined) {
    fail("laneWaypointOutsideCorridor", `${at}: never enters the Grid`);
  }
  return createLane(index, waypoints, entryDirection, crossing);
}

/** Parse a Map file; throws MapParseError with a specific code when malformed. */
export function parseMap(text: string): GameMap {
  const header = readLines(text);
  const { id, name, tier } = header;
  if (id === undefined || id === "") fail("missingHeader", 'missing "id" header');
  if (name === undefined || name === "") fail("missingHeader", 'missing "name" header');
  if (tier === undefined) fail("missingHeader", 'missing "tier" header');
  if (!isTier(tier)) fail("badTier", `tier "${tier}" is not easy, normal, or hard`);
  if (!header.gridSeen) fail("missingHeader", 'missing "grid" block');

  const corridor = parseGrid(header.gridRows);
  const corridorCells: Cell[] = [];
  corridor.forEach((isCorridorCell, i) => {
    if (isCorridorCell) corridorCells.push({ col: i % GRID_COLS, row: Math.floor(i / GRID_COLS) });
  });
  const isCorridor = (cell: Cell): boolean =>
    isOnGrid(cell) && corridor[cell.row * GRID_COLS + cell.col] === true;
  const isBuildable = (cell: Cell): boolean =>
    isOnGrid(cell) && corridor[cell.row * GRID_COLS + cell.col] === false;

  const lanes: Lane[] = [];
  for (let index = 0; index < LANE_COUNT; index += 1) {
    const laneLine = header.laneLines.get(index);
    if (laneLine === undefined) fail("missingLane", `missing "lane ${String(index)}" line`);
    const entryDirection = header.entries.get(index);
    if (entryDirection === undefined) fail("missingHeader", `missing "entry ${String(index)}" header`);
    lanes.push(parseLane(index, laneLine, entryDirection, isCorridor));
  }

  return {
    id,
    displayName: name,
    tier,
    cols: GRID_COLS,
    rows: GRID_ROWS,
    lanes,
    corridorCells,
    isBuildable,
    isCorridor,
  };
}
