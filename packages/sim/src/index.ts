/**
 * Public surface of the sim package.
 *
 * Tests import only from here. Commands and steps go in; Snapshots, Events,
 * and replay digests come out. Nothing below `src/` other than this file is a
 * supported import.
 */
export { createRun } from "./engine/run.js";
export type { Run, RunInputs } from "./engine/run.js";
export { replayRun, defaultResolver, ReplayError } from "./replay.js";
export type { ReplayResolver, ReplayResult } from "./replay.js";
export { digestValue } from "./engine/digest.js";
export * from "./types.js";

export * from "./map/index.js";
export * from "./ruleset/index.js";
