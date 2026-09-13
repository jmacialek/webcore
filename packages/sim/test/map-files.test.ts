/**
 * Spec stories 54 and 56: Maps are text files. The sim embeds each file's
 * text so it needs no file system; this guards the mirror against drift.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMap, SWITCHBACK_TEXT, switchback } from "../src/index.js";

const file = new URL("../maps/switchback.map", import.meta.url);

describe("Map files under packages/sim/maps", () => {
  it("switchback.map is the text the sim embeds", () => {
    expect(readFileSync(file, "utf8").trimEnd()).toBe(SWITCHBACK_TEXT.trimEnd());
  });

  it("parses to the same Map the sim ships", () => {
    const fromFile = parseMap(readFileSync(file, "utf8"));
    expect(fromFile.corridorCells).toEqual(switchback.corridorCells);
    expect(fromFile.lanes.map((l) => l.waypoints)).toEqual(switchback.lanes.map((l) => l.waypoints));
  });
});
