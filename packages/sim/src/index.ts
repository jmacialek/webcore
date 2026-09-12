/**
 * Public surface of the sim package.
 *
 * Tests import only from here. Commands and steps go in; Snapshots, Events,
 * and replay digests come out. Nothing below `src/` other than this file is a
 * supported import.
 */
export { createRun } from "./engine/run.js";
export type { Run } from "./engine/run.js";
export type { Snapshot, SimEvent, RunInputs } from "./types.js";
