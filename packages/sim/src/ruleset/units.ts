/**
 * One-time unit conversion from the v1.2 Flash build to sim units (ADR 0002).
 *
 * The original ran its logic at 40 frames per second on a 25 px Cell. Ruleset
 * data quotes the research values verbatim (px, frames, px/frame) and converts
 * through these helpers so the source of every constant stays visible.
 */

/** Original logic frames per second. */
export const ORIGINAL_FPS = 40;
/** Original pixels per Cell. */
export const PX_PER_CELL = 25;

/** Pixels to Cells. */
export function cells(px: number): number {
  return px / PX_PER_CELL;
}

/** Frames to seconds. */
export function seconds(frames: number): number {
  return frames / ORIGINAL_FPS;
}

/** Pixels per frame to Cells per second. */
export function cellsPerSecond(pxPerFrame: number): number {
  return (pxPerFrame * ORIGINAL_FPS) / PX_PER_CELL;
}

/** Pixels per frame per frame to Cells per second squared. */
export function cellsPerSecondSquared(pxPerFrame2: number): number {
  return (pxPerFrame2 * ORIGINAL_FPS * ORIGINAL_FPS) / PX_PER_CELL;
}
