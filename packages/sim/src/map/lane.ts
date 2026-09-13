/**
 * Lane geometry (CONTEXT.md: Lane, Entry, Exit, Cell).
 *
 * Pure arithmetic only: `Math.sqrt` and `Math.floor` are correctly rounded
 * by IEEE 754, so results are bit-identical across JS engines. No
 * `Math.hypot`, `Math.pow`, or transcendental functions.
 */
import { GRID_COLS, GRID_ROWS } from "./types.js";
import type { Cell, EntryDirection, Lane, Point } from "./types.js";

/** The Cell containing a point: (floor(x), floor(y)). */
export function cellOf(point: Point): Cell {
  return { col: Math.floor(point.x), row: Math.floor(point.y) };
}

/** True when the Cell lies inside the 22 x 18 Grid. */
export function isOnGrid(cell: Cell): boolean {
  return (
    cell.col >= 0 && cell.col < GRID_COLS && cell.row >= 0 && cell.row < GRID_ROWS
  );
}

/** A precomputed polyline segment from `a` towards `a + d`. */
interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly dx: number;
  readonly dy: number;
  /** Segment length in Cells. */
  readonly len: number;
  /** Distance along the Lane at which this segment starts. */
  readonly start: number;
}

function segmentsOf(waypoints: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  let start = 0;
  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a === undefined || b === undefined) break;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segments.push({ ax: a.x, ay: a.y, dx, dy, len, start });
    start += len;
  }
  return segments;
}

/**
 * Every on-Grid Cell of the closed segment, in travel order. Find both
 * sides of every floor transition using the same interpolation as
 * `positionAt`. Checking only the algebraic Grid-line parameters misses
 * Cells reached when either coordinate rounds onto a line slightly early.
 * At mixed-direction corners the exact point can also belong to neither
 * adjacent interval's Cell. Endpoints use floor too; points on the
 * right/bottom Grid edges remain off-Grid.
 */
export function cellsCrossed(a: Point, b: Point): Cell[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const times = new Set([0, 1]);
  const crossings = (origin: number, delta: number, limit: number): void => {
    if (delta === 0) return;
    for (let line = 0; line <= limit; line += 1) {
      const startsAbove = origin >= line;
      if ((origin + delta >= line) === startsAbove) continue;
      let low = 0;
      let high = 1;
      // Interpolation is monotone on each axis. Bisect until low and high
      // are adjacent doubles, so even a Cell occupied for one parameter
      // value is included. No epsilon can express that at every magnitude.
      for (;;) {
        const middle = low + (high - low) / 2;
        if (middle === low || middle === high) break;
        if ((origin + delta * middle >= line) === startsAbove) low = middle;
        else high = middle;
      }
      times.add(low);
      times.add(high);
    }
  };
  crossings(a.x, dx, GRID_COLS);
  crossings(a.y, dy, GRID_ROWS);
  const cells: Cell[] = [];
  const seen = new Set<number>();
  const visit = (point: Point): void => {
    const cell = cellOf(point);
    const key = cell.row * GRID_COLS + cell.col;
    if (isOnGrid(cell) && !seen.has(key)) {
      seen.add(key);
      cells.push(cell);
    }
  };
  const along = (t: number): Point => ({ x: a.x + dx * t, y: a.y + dy * t });
  visit(a);
  for (const t of [...times].sort((left, right) => left - right)) {
    visit(along(t));
  }
  visit(b);
  return cells;
}

/**
 * Entry and Exit of a polyline: the first on-Grid Cell it passes through
 * and the last on-Grid Cell before it leaves. Undefined when the polyline
 * never touches the Grid.
 */
export function gridCrossing(
  waypoints: readonly Point[],
): { readonly entry: Cell; readonly exit: Cell } | undefined {
  let entry: Cell | undefined;
  let exit: Cell | undefined;
  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a === undefined || b === undefined) break;
    const cells = cellsCrossed(a, b);
    entry ??= cells[0];
    exit = cells[cells.length - 1] ?? exit;
  }
  return entry !== undefined && exit !== undefined ? { entry, exit } : undefined;
}

/**
 * Build a Lane from validated waypoints (at least two, first and last
 * off-Grid, no zero-length segment) and its Grid crossing.
 */
export function createLane(
  index: number,
  waypoints: readonly Point[],
  entryDirection: EntryDirection,
  crossing: { readonly entry: Cell; readonly exit: Cell },
): Lane {
  const points = waypoints.map((p) => ({ x: p.x, y: p.y }));
  const segments = segmentsOf(points);
  const firstSegment = segments[0];
  const lastPoint = points[points.length - 1];
  if (firstSegment === undefined || lastPoint === undefined) {
    throw new RangeError("a Lane needs at least two waypoints");
  }
  // Rebound so the hoisted closures below see the narrowed types.
  const first: Segment = firstSegment;
  const last: Point = lastPoint;
  const length = segments.reduce((sum, s) => sum + s.len, 0);

  function along(s: Segment, distance: number): Point {
    const t = (distance - s.start) / s.len;
    return { x: s.ax + s.dx * t, y: s.ay + s.dy * t };
  }

  function positionAt(distance: number): Point {
    if (distance <= 0) return along(first, distance);
    if (distance >= length) return { x: last.x, y: last.y };
    let i = 0;
    while (i + 1 < segments.length) {
      const next = segments[i + 1];
      if (next === undefined || distance < next.start) break;
      i += 1;
    }
    const s = segments[i] ?? first;
    return along(s, distance);
  }

  return {
    index,
    waypoints: points,
    entryDirection,
    length,
    entry: { col: crossing.entry.col, row: crossing.entry.row },
    exit: { col: crossing.exit.col, row: crossing.exit.row },
    positionAt,
  };
}
