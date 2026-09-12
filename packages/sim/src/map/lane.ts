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
 * Liang-Barsky clip of one segment against the Grid rectangle
 * [0, GRID_COLS] x [0, GRID_ROWS]. Returns the parameter range [tIn, tOut]
 * (fractions of the segment) that lies inside, or undefined when the segment
 * misses the Grid.
 */
function clipToGrid(s: Segment): { readonly tIn: number; readonly tOut: number } | undefined {
  let tIn = 0;
  let tOut = 1;
  // Each edge is the constraint p * t <= q.
  const edges: readonly (readonly [number, number])[] = [
    [-s.dx, s.ax],
    [s.dx, GRID_COLS - s.ax],
    [-s.dy, s.ay],
    [s.dy, GRID_ROWS - s.ay],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > tIn) tIn = t;
    } else if (t < tOut) {
      tOut = t;
    }
  }
  return tIn <= tOut ? { tIn, tOut } : undefined;
}

/** The Cell of a point known to be on the Grid boundary or inside it. */
function boundaryCell(s: Segment, t: number): Cell {
  const cell = cellOf({ x: s.ax + s.dx * t, y: s.ay + s.dy * t });
  return {
    col: Math.min(Math.max(cell.col, 0), GRID_COLS - 1),
    row: Math.min(Math.max(cell.row, 0), GRID_ROWS - 1),
  };
}

/**
 * Entry and Exit of a polyline: the first on-Grid Cell it passes through
 * and the last on-Grid Cell before it leaves. Undefined when the polyline
 * never touches the Grid.
 */
export function gridCrossing(
  waypoints: readonly Point[],
): { readonly entry: Cell; readonly exit: Cell } | undefined {
  const segments = segmentsOf(waypoints);
  let entry: Cell | undefined;
  let exit: Cell | undefined;
  for (const s of segments) {
    const clip = clipToGrid(s);
    if (clip === undefined) continue;
    entry ??= boundaryCell(s, clip.tIn);
    exit = boundaryCell(s, clip.tOut);
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
