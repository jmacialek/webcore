/**
 * M1-03: Original and Classic Ruleset data (#4).
 *
 * Numbers are cited by section of `docs/research/vector-td-towers-and-targeting.md`
 * ("towers"), `docs/research/vector-td-waves-and-economy.md` ("waves") and
 * `docs/research/vector-td-v12-verification.md` ("verify"). Every per-frame
 * value is converted at 40 frames per second and 25 px per Cell (ADR 0002).
 */
import { describe, expect, it } from "vitest";
import {
  applyRulesetDiff,
  classic,
  classicDiff,
  getRuleset,
  getTowerSpec,
  original,
  waveComposition,
  waveStats,
  waveTable,
} from "../src/index.js";
import type { Ruleset, TowerKind, TowerSpec, VectoidType } from "../src/index.js";

function tower(ruleset: Ruleset, kind: TowerKind): TowerSpec {
  const spec = getTowerSpec(ruleset, kind);
  if (spec === undefined) {
    throw new Error(`${ruleset.id} has no Tower ${kind}`);
  }
  return spec;
}

function count(types: readonly VectoidType[], type: VectoidType): number {
  return types.filter((t) => t === type).length;
}

/** Sidebar order (towers 1.1, verify 3). */
const originalKinds: readonly TowerKind[] = [
  "greenLaser1",
  "redRefractor",
  "purplePower1",
  "blueRays1",
  "greenLaser2",
  "littleRedSpammer",
  "purplePower2",
  "blueRays2",
  "greenLaser3",
  "redRockets",
  "purplePower3",
];

/**
 * v1.2 base cost / damage / range px / rof frames (towers 1.1 with the
 * Corrections section: Green Laser 3 200, Spammer 600 / 90 px, Blue Rays 1
 * 500, Blue Rays 2 4000; waves 2 price list agrees).
 */
const originalBaseStats: Readonly<
  Record<TowerKind, readonly [cost: number, damage: number, rangePx: number, rofFrames: number]>
> = {
  greenLaser1: [100, 22, 70, 1],
  greenLaser2: [400, 45, 70, 1],
  greenLaser3: [2000, 200, 70, 1],
  redRefractor: [200, 110, 80, 10],
  littleRedSpammer: [800, 600, 90, 4],
  redRockets: [2500, 30000, 150, 45],
  purplePower1: [300, 2650, 100, 40],
  purplePower2: [900, 8500, 100, 40],
  purplePower3: [2800, 22000, 100, 40],
  blueRays1: [300, 500, 70, 40],
  blueRays2: [500, 4000, 80, 120],
  blueFrostRockets: [2200, 3000, 150, 60],
};

describe("Original Ruleset (v1.2 verbatim)", () => {
  it("is identified as original 1.2.0 and resolves from the registry", () => {
    expect(original.id).toBe("original");
    expect(original.version).toBe("1.2.0");
    expect(getRuleset("original")).toBe(original);
  });

  it("contains exactly the eleven v1.2 Towers in sidebar order and no Blue Frost Rockets", () => {
    expect(original.towers.map((t) => t.kind)).toEqual(originalKinds);
    expect(getTowerSpec(original, "blueFrostRockets")).toBeUndefined();
  });

  it.each(originalKinds)("%s has the research cost, damage, Range, and cooldown", (kind) => {
    const [cost, damage, rangePx, rofFrames] = originalBaseStats[kind];
    const spec = tower(original, kind);
    expect(spec.cost).toBe(cost);
    expect(spec.damage).toBe(damage);
    expect(spec.range).toBe(rangePx / 25);
    expect(spec.cooldown).toBe(rofFrames / 40);
  });

  it("no v1.2 Tower carries placeholders", () => {
    for (const spec of original.towers) {
      expect(spec.placeholders ?? []).toEqual([]);
    }
  });

  it("assigns Trees and Tiers (towers 1.1)", () => {
    const treeTier = original.towers.map((t) => [t.kind, t.tree, t.tier]);
    expect(treeTier).toEqual([
      ["greenLaser1", "green", 1],
      ["redRefractor", "red", 1],
      ["purplePower1", "purple", 1],
      ["blueRays1", "blue", 1],
      ["greenLaser2", "green", 2],
      ["littleRedSpammer", "red", 2],
      ["purplePower2", "purple", 2],
      ["blueRays2", "blue", 2],
      ["greenLaser3", "green", 3],
      ["redRockets", "red", 3],
      ["purplePower3", "purple", 3],
    ]);
  });

  it("uses the v1.2 default Targeting Modes and selectability (towers 3.1, verify 1.1)", () => {
    const modes = original.towers.map((t) => [t.kind, t.defaultMode, t.selectableModes]);
    expect(modes).toEqual([
      ["greenLaser1", "close", true],
      ["redRefractor", "close", true],
      ["purplePower1", "hard", true],
      ["blueRays1", "fastest", false],
      ["greenLaser2", "close", true],
      ["littleRedSpammer", "random", false],
      ["purplePower2", "hard", true],
      ["blueRays2", "fastest", false],
      ["greenLaser3", "close", true],
      ["redRockets", "hard", true],
      ["purplePower3", "hard", true],
    ]);
  });

  it("exposes Target Lock on Refractor, Rockets, and Purple 1-3 only (verify 1.1)", () => {
    const lockable = original.towers.filter((t) => t.lockable).map((t) => t.kind);
    expect(lockable).toEqual([
      "redRefractor",
      "purplePower1",
      "purplePower2",
      "redRockets",
      "purplePower3",
    ]);
  });

  it("converts the firing mechanics (towers 1.3)", () => {
    expect(tower(original, "greenLaser1").mechanics).toEqual({
      type: "laser",
      hitsPerSecond: 40,
      chainHops: 0,
      chainRadius: 2,
      reacquireDelay: 0.25,
    });
    expect(tower(original, "greenLaser2").mechanics).toMatchObject({ type: "laser", chainHops: 1 });
    expect(tower(original, "greenLaser3").mechanics).toMatchObject({ type: "laser", chainHops: 2 });
    expect(tower(original, "redRefractor").mechanics).toEqual({
      type: "splashShot",
      splashRadius: 2,
      splashEdgeFraction: 0.5,
    });
    expect(tower(original, "littleRedSpammer").mechanics).toEqual({
      type: "spam",
      rocketSpeedMin: 3.2,
      rocketSpeedMax: 6.4,
      rocketAcceleration: 6.4,
    });
    expect(tower(original, "redRockets").mechanics).toEqual({
      type: "homingRocket",
      rocketSpeedMax: 4.8,
      rocketAcceleration: 6.4,
    });
    expect(tower(original, "purplePower1").mechanics).toEqual({
      type: "chargeBeam",
      chargeSeconds: 0.75,
      hitsPerCycle: 1,
      slowsDuringCharge: false,
    });
    expect(tower(original, "purplePower2").mechanics).toMatchObject({ hitsPerCycle: 2, slowsDuringCharge: false });
    expect(tower(original, "purplePower3").mechanics).toMatchObject({ hitsPerCycle: 1, slowsDuringCharge: true });
    expect(tower(original, "blueRays1").mechanics).toEqual({ type: "multiSlow", slots: 4, factor: 1 / 6 });
    expect(tower(original, "blueRays2").mechanics).toEqual({ type: "stun" });
  });

  it("defines the seven Vectoid types (waves 1.1, verify 4)", () => {
    const v = original.vectoids;
    expect(Object.keys(v).sort()).toEqual(
      ["bigPurpleBox", "blueSpinner", "bonusCell", "greenFlyer", "hardGrey", "redShredder", "yellowSprinter"].sort(),
    );
    expect(v.redShredder).toMatchObject({ displayName: "Red Shredder", colour: "red" });
    expect(v.blueSpinner).toMatchObject({ displayName: "Blue Spinner", colour: "blue" });
    expect(v.greenFlyer).toMatchObject({ displayName: "Green Flyer", colour: "green" });
    expect(v.bigPurpleBox).toMatchObject({ displayName: "Big Purple Box", colour: "purple" });
    expect(v.yellowSprinter).toMatchObject({ displayName: "Yellow Sprinter", speedMultiplier: 2 });
    expect(v.yellowSprinter.colour).toBeUndefined();
    expect(v.hardGrey).toMatchObject({ displayName: "Hard Grey", damageTaken: 0.75, hpMultiplier: 1 });
    expect(v.hardGrey.colour).toBeUndefined();
    expect(v.bonusCell).toMatchObject({
      displayName: "Bonus Cell",
      hpMultiplier: 4,
      damageTaken: 0.75,
      awardsBonusPoint: true,
    });
    for (const type of ["redShredder", "blueSpinner", "greenFlyer", "bigPurpleBox", "hardGrey"] as const) {
      expect(v[type]).toMatchObject({ speedMultiplier: 1, hpMultiplier: 1, awardsBonusPoint: false });
    }
    for (const type of ["redShredder", "blueSpinner", "greenFlyer", "yellowSprinter", "bigPurpleBox"] as const) {
      expect(v[type].damageTaken).toBe(1);
    }
  });

  it("carries the economy, scoring, upgrade, Bonus Item, movement, and colour constants (towers 1.2-1.5, 2.1; waves 1.2, 2, 3, 4)", () => {
    expect(original.economy).toEqual({
      lives: 20,
      interest: 3,
      maxAliveToSend: 10,
      tiers: {
        easy: { startBank: 275, startHp: 550, hpDivisor: 5.0, hpDivisorStep: 0.03, bountyOffset: 4 },
        normal: { startBank: 275, startHp: 600, hpDivisor: 4.5, hpDivisorStep: 0.03, bountyOffset: 3 },
        hard: { startBank: 250, startHp: 625, hpDivisor: 4.2, hpDivisorStep: 0.02, bountyOffset: 2 },
      },
    });
    expect(original.scoring).toEqual({ killMultiplier: 100, leakMultiplier: 100, interestMultiplier: 2 });
    expect(original.upgrade).toEqual({
      maxRank: 10,
      costDivisor: 2,
      damageDivisor: 2.2,
      rangeDivisor: 20,
      sellPercent: 75,
    });
    expect(original.bonusItems).toEqual({
      interestIncrease: 3,
      panicLives: 5,
      boosterPercent: 25,
      boosterRadius: 4,
    });
    expect(original.movement).toEqual({
      baseSpeed: 1.6,
      spawnSpacing: 0.8,
      speedRecovery: 0.64,
      vectoidsPerLane: 14,
    });
    expect(original.colourRule).toEqual({ sameColour: 1.5, oppositeColour: 0.5 });
    expect(original.bonusWaveEvery).toBe(5);
    expect(original.variants).toEqual({ blueTowersSkipPenalties: true });
  });

  it("has the fifty-entry v1.2 Wave sequence (waves 1.1)", () => {
    const codes: Readonly<Record<number, VectoidType | "mixed">> = {
      1: "redShredder",
      2: "blueSpinner",
      3: "greenFlyer",
      4: "yellowSprinter",
      5: "bigPurpleBox",
      7: "hardGrey",
      8: "mixed",
    };
    const levels = [
      2, 1, 2, 3, 7, 4, 2, 5, 2, 7, 2, 3, 2, 4, 7, 5, 2, 1, 2, 7, 2, 4, 2, 5, 7, 1, 2, 3, 2, 7, 4, 2, 5, 2, 7, 5, 2,
      1, 2, 7, 1, 2, 3, 2, 7, 2, 1, 2, 4, 8,
    ];
    expect(original.waves).toHaveLength(50);
    expect(original.waves).toEqual(levels.map((code) => codes[code]));
  });
});

describe("unit conversions (ADR 0002: 40 fps, 25 px per Cell)", () => {
  it("base speed 1 px/frame is 1.6 Cells/s and Yellow Sprinter runs at 3.2", () => {
    expect(original.movement.baseSpeed).toBe(1.6);
    expect(original.movement.baseSpeed * original.vectoids.yellowSprinter.speedMultiplier).toBe(3.2);
  });

  it("Ranges span 70 px = 2.8 Cells (Green Laser 1) to 150 px = 6.0 Cells (Red Rockets)", () => {
    expect(tower(original, "greenLaser1").range).toBe(2.8);
    expect(tower(original, "redRockets").range).toBe(6.0);
  });

  it("Red Rockets fire once per 45 frames = 1.125 s; Green Laser 1 hits every frame = 0.025 s", () => {
    expect(tower(original, "redRockets").cooldown).toBe(1.125);
    expect(tower(original, "greenLaser1").cooldown).toBe(0.025);
  });
});

describe("Classic Ruleset (ADR 0001: Original plus an explicit diff)", () => {
  it("is identified as classic 1.0.0 and resolves from the registry", () => {
    expect(classic.id).toBe("classic");
    expect(classic.version).toBe("1.0.0");
    expect(getRuleset("classic")).toBe(classic);
    expect(getRuleset("nope")).toBeUndefined();
  });

  it("classicDiff contains only the blue-bug fix and Blue Frost Rockets", () => {
    expect(Object.keys(classicDiff).sort()).toEqual(["addTowers", "id", "variants", "version"]);
    expect(classicDiff.id).toBe("classic");
    expect(classicDiff.version).toBe("1.0.0");
    expect(classicDiff.variants).toEqual({ blueTowersSkipPenalties: false });
    expect(classicDiff.addTowers?.map((t) => t.kind)).toEqual(["blueFrostRockets"]);
  });

  it("is applyRulesetDiff(original, classicDiff)", () => {
    expect(classic).toEqual(applyRulesetDiff(original, classicDiff));
  });

  it("has twelve Towers: the eleven Originals unchanged plus Blue Frost Rockets", () => {
    expect(classic.towers).toHaveLength(12);
    expect(classic.towers.slice(0, 11)).toEqual(original.towers);
    expect(classic.towers[11]?.kind).toBe("blueFrostRockets");
  });

  it("differs from Original only in id, version, towers, and variants", () => {
    const diffed = new Set(["id", "version", "towers", "variants"]);
    const outsideDiff = (ruleset: Ruleset): Record<string, unknown> =>
      Object.fromEntries(Object.entries(ruleset).filter(([key]) => !diffed.has(key)));
    const shared = outsideDiff(classic);
    expect(Object.keys(shared).sort()).toEqual(
      ["vectoids", "waves", "bonusWaveEvery", "economy", "scoring", "upgrade", "bonusItems", "movement", "colourRule"].sort(),
    );
    expect(shared).toEqual(outsideDiff(original));
    expect(classic.variants).toEqual({ blueTowersSkipPenalties: false });
    expect(original.variants).toEqual({ blueTowersSkipPenalties: true });
  });

  it("Blue Frost Rockets is the Blue Tier 3 with placeholder numbers", () => {
    const spec = tower(classic, "blueFrostRockets");
    expect(spec).toMatchObject({
      displayName: "Blue Frost Rockets",
      tree: "blue",
      tier: 3,
      cost: 2200,
      damage: 3000,
      range: 6.0,
      cooldown: 1.5,
      defaultMode: "close",
      selectableModes: true,
      lockable: true,
      mechanics: {
        type: "homingRocket",
        rocketSpeedMax: 4.8,
        rocketAcceleration: 6.4,
        splashSlow: { radius: 2, factor: 1 / 6, duration: 1 },
      },
    });
    expect(spec.placeholders).toEqual([
      "damage",
      "range",
      "cooldown",
      "mechanics.splashSlow.radius",
      "mechanics.splashSlow.factor",
      "mechanics.splashSlow.duration",
    ]);
    for (const other of classic.towers.filter((t) => t.kind !== "blueFrostRockets")) {
      expect(other.placeholders ?? []).toEqual([]);
    }
  });

  it("applyRulesetDiff is pure and leaves Original untouched", () => {
    expect(original.towers).toHaveLength(11);
    expect(original.variants.blueTowersSkipPenalties).toBe(true);
    const again = applyRulesetDiff(original, { id: "x", version: "0.0.0" });
    expect(again.towers).toEqual(original.towers);
    expect(again.variants).toEqual(original.variants);
    expect(again.id).toBe("x");
  });

  it("applyRulesetDiff rejects a Tower kind the base already has", () => {
    const dup = tower(original, "greenLaser1");
    expect(() => applyRulesetDiff(original, { id: "x", version: "0.0.0", addTowers: [dup] })).toThrow(
      /greenLaser1/,
    );
  });
});

describe("waveStats / waveTable (waves 1.2)", () => {
  /** Easy HP column of the research table, Waves 1 to 50. */
  const easyHp = [
    550, 660, 791, 947, 1133, 1354, 1616, 1927, 2296, 2734, 3252, 3865, 4590, 5446, 6456, 7647, 9050, 10701, 12643,
    14925, 17604, 20747, 24432, 28748, 33800, 39709, 46614, 54678, 64089, 75063, 87850, 102739, 120064, 140208,
    163615, 190793, 222329, 258896, 301268, 350334, 407114, 472777, 548664, 636310, 737472, 854160, 988673, 1143637,
    1322051, 1527338,
  ];

  it("reproduces all fifty Easy rows exactly, ending at 1,527,338 hp and $54", () => {
    const table = waveTable(original, "easy");
    expect(table).toHaveLength(50);
    expect(table.map((row) => row.hp)).toEqual(easyHp);
    expect(table.map((row) => row.bounty)).toEqual(easyHp.map((_, i) => i + 1 + 4));
    expect(table[49]).toEqual({ hp: 1527338, bounty: 54 });
  });

  it("waveStats agrees with waveTable for every Wave", () => {
    const table = waveTable(original, "easy");
    table.forEach((row, i) => {
      expect(waveStats(original, "easy", i + 1)).toEqual(row);
    });
  });

  it("spot-checks Normal and Hard", () => {
    expect(waveStats(original, "normal", 1)).toEqual({ hp: 600, bounty: 4 });
    expect(waveStats(original, "normal", 45)).toEqual({ hp: 1537129, bounty: 48 });
    expect(waveStats(original, "normal", 50)).toEqual({ hp: 3371170, bounty: 53 });
    expect(waveStats(original, "hard", 1)).toEqual({ hp: 625, bounty: 3 });
    expect(waveStats(original, "hard", 50)).toEqual({ hp: 8469807, bounty: 52 });
  });

  it("is a pure function of the Ruleset: Classic shares Original's table", () => {
    expect(waveTable(classic, "hard")).toEqual(waveTable(original, "hard"));
  });

  it("rejects Waves below 1 or non-integers", () => {
    expect(() => waveStats(original, "easy", 0)).toThrow(RangeError);
    expect(() => waveStats(original, "easy", 1.5)).toThrow(RangeError);
  });
});

describe("waveComposition (waves 1.1, verify 4)", () => {
  it("Wave 1 is 28 Blue Spinners: Lane 0's 14 then Lane 1's 14", () => {
    const types = waveComposition(original, 1);
    expect(types).toHaveLength(28);
    expect(types.every((t) => t === "blueSpinner")).toBe(true);
  });

  it("every fifth Wave is 27 Hard Grey and one Bonus Cell as the 28th", () => {
    for (const wave of [5, 10, 15, 20, 25, 30, 35, 40, 45]) {
      const types = waveComposition(original, wave);
      expect(types).toHaveLength(28);
      expect(types.slice(0, 27).every((t) => t === "hardGrey")).toBe(true);
      expect(types[27]).toBe("bonusCell");
    }
  });

  it("no other Wave carries a Bonus Cell", () => {
    for (let wave = 1; wave <= 49; wave += 1) {
      if (wave % 5 !== 0) {
        expect(count(waveComposition(original, wave), "bonusCell")).toBe(0);
      }
    }
  });

  it("Wave 50 is 4 Red, 5 Blue, 5 Green, 5 Yellow, 5 Purple, 3 Hard Grey, 1 Bonus Cell in spawn order", () => {
    const types = waveComposition(original, 50);
    const expected: VectoidType[] = [
      ...Array<VectoidType>(4).fill("redShredder"),
      ...Array<VectoidType>(5).fill("blueSpinner"),
      ...Array<VectoidType>(5).fill("greenFlyer"),
      ...Array<VectoidType>(5).fill("yellowSprinter"),
      ...Array<VectoidType>(5).fill("bigPurpleBox"),
      ...Array<VectoidType>(3).fill("hardGrey"),
      "bonusCell",
    ];
    expect(types).toEqual(expected);
  });

  it("rejects Waves outside the sequence", () => {
    expect(() => waveComposition(original, 0)).toThrow(RangeError);
    expect(() => waveComposition(original, 51)).toThrow(RangeError);
  });
});
