/**
 * Map contract (CONTEXT.md: Grid, Cell, Map, Corridor, Lane, Entry, Exit).
 *
 * World unit is the Cell; one original pixel is 1/25 Cell. The Grid is 22
 * columns by 18 rows; column 0 is the left edge, row 0 the top edge. A point
 * (x, y) in Cells lies in Cell (floor(x), floor(y)).
 */

export const GRID_COLS = 22;
export const GRID_ROWS = 18;

export type MapTier = "easy" | "normal" | "hard";

export interface Cell {
  readonly col: number;
  readonly row: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * One of the two waypoint polylines inside a Corridor. Distance along a Lane
 * is measured in Cells from the first waypoint (which is off-Grid).
 */
export interface Lane {
  /** Lane index within the Map: 0 or 1. */
  readonly index: number;
  /** Waypoints in Cell coordinates. First and last are off-Grid. */
  readonly waypoints: readonly Point[];
  /** Total polyline length in Cells. */
  readonly length: number;
  /** First on-Grid Cell the Lane passes through. */
  readonly entry: Cell;
  /** Last on-Grid Cell the Lane passes through. */
  readonly exit: Cell;
  /**
   * Position at `distance` Cells along the Lane. Negative distances
   * extrapolate backwards along the first segment (the spawn queue);
   * distances beyond `length` clamp to the last waypoint.
   */
  positionAt(distance: number): Point;
}

export interface GameMap {
  readonly id: string;
  readonly displayName: string;
  readonly tier: MapTier;
  readonly cols: typeof GRID_COLS;
  readonly rows: typeof GRID_ROWS;
  /** Exactly two Lanes, in spawn order (Lane 0 spawns first). */
  readonly lanes: readonly Lane[];
  /** Every Corridor Cell, row-major. */
  readonly corridorCells: readonly Cell[];
  /** True when the Cell is on-Grid and not part of the Corridor. */
  isBuildable(cell: Cell): boolean;
  /** True when the Cell is on-Grid and part of the Corridor. */
  isCorridor(cell: Cell): boolean;
}

export type MapParseErrorCode =
  | "missingHeader"
  | "badGridSize"
  | "badGridCharacter"
  | "missingLane"
  | "tooManyLanes"
  | "laneTooShort"
  | "laneEntryNotOffGrid"
  | "laneExitNotOffGrid"
  | "laneWaypointOutsideCorridor"
  | "badWaypoint"
  | "badTier"
  | "badEntryDirection";

export class MapParseError extends Error {
  readonly code: MapParseErrorCode;
  constructor(code: MapParseErrorCode, message: string) {
    super(message);
    this.name = "MapParseError";
    this.code = code;
  }
}
