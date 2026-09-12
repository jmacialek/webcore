import { describe, expect, it } from "vitest";
import { createRun } from "../src/index.js";

const inputs = { rulesetId: "placeholder", mapId: "placeholder", seed: 1 };

describe("sim scaffold (M1-01)", () => {
  it("two Runs with identical inputs give identical Snapshots after the same steps", () => {
    const a = createRun(inputs);
    const b = createRun(inputs);
    for (let i = 0; i < 10; i += 1) {
      a.step();
      b.step();
    }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().tick).toBe(10);
  });

  it("a fresh Run emits no Events on its first step", () => {
    expect(createRun(inputs).step()).toEqual([]);
  });
});
