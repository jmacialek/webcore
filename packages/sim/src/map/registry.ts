/** Built-in Maps by id. */
import { switchback } from "./switchback.js";
import type { GameMap } from "./types.js";

const builtIn: ReadonlyMap<string, GameMap> = new Map([[switchback.id, switchback]]);

/** The built-in Map with this id, or undefined. */
export function getMap(id: string): GameMap | undefined {
  return builtIn.get(id);
}
