/**
 * Switchback, the first Map (docs/research/vector-td-maps.md, section 2,
 * "1. SWITCHBACK"). Waypoints are the research marker pixels divided by 25;
 * the grid is the research ASCII sketch with A, B, and # Cells as Corridor.
 * Tier is a design decision for this tribute (the original has no per-Map
 * tiers): Switchback is the easy Map.
 */
import { parseMap } from "./parse.js";
import type { GameMap } from "./types.js";

export const SWITCHBACK_TEXT = `# Switchback: one Entry on the top edge, one Exit on the right edge.
id switchback
name Switchback
tier easy
entry 0 up
entry 1 up
grid
.##...................
.##...................
.####################.
.####################.
...................##.
.##############....##.
.##############....##.
.##..........##....##.
.###########.########.
.###########.########.
..........##..........
.###########.######...
.###########.######...
.##..........##..##...
.##############..##...
.##############..#####
.................#####
......................
lane 0 1.6,-0.4 1.6,3.4 19.6,3.4 19.6,8.6 14.4,8.6 14.4,5.6 1.6,5.6 1.6,9.4 10.4,9.4 10.4,11.6 1.6,11.6 1.6,15.4 14.4,15.4 14.4,12.6 17.6,12.6 17.6,16.4 22.4,16.4
lane 1 2.4,-0.4 2.4,2.6 20.4,2.6 20.4,9.4 13.6,9.4 13.6,6.6 2.6,6.6 2.6,8.6 11.4,8.6 11.4,12.4 2.6,12.4 2.6,14.6 13.6,14.6 13.6,11.6 18.4,11.6 18.4,15.6 22.4,15.6`;

export const switchback: GameMap = parseMap(SWITCHBACK_TEXT);
