/**
 * The Original Ruleset: Vector TD v1.2 (`ftd.swf`) verbatim (ADR 0001).
 *
 * Never selectable in the game; it exists as the base Classic is diffed from
 * and as a sim test fixture. Sources, by section:
 *   towers  = docs/research/vector-td-towers-and-targeting.md
 *   waves   = docs/research/vector-td-waves-and-economy.md
 *   verify  = docs/research/vector-td-v12-verification.md
 * Values are quoted in the original px / frames and converted once through
 * `units.ts` (ADR 0002).
 */

import type { Ruleset, TowerSpec, VectoidSpec, VectoidType, WaveEntry } from "./types.js";
import { cells, cellsPerSecond, cellsPerSecondSquared, seconds } from "./units.js";

/** Chain hops (Green 2/3) and Refractor splash both reach 50 px (towers 1.3). */
const CHAIN_AND_SPLASH_PX = 50;
/** Lasers wait 10 frames after losing a target before re-scanning (towers 1.3). */
const LASER_REACQUIRE_FRAMES = 10;
/**
 * Rockets gain 0.1 px/frame every frame (towers 1.3): 0.1 x 40 x 40 / 25 =
 * 6.4 Cells/s^2, so a Red Rocket reaches its 3 px/frame (4.8 Cells/s) cap in
 * 0.75 s, the original's 30 frames. An earlier spec quoted "0.16", which
 * divided by the frame rate only once; that was a unit slip.
 */
const ROCKET_ACCELERATION = cellsPerSecondSquared(0.1);

/** v1.2 Towers in sidebar order (verify 3): rows of the 4x4 panel, left to right. */
const towers: readonly TowerSpec[] = [
  // Row 1: Tier 1 of each Tree.
  {
    kind: "greenLaser1",
    displayName: "Green Laser 1",
    tree: "green",
    tier: 1,
    cost: 100, // towers 1.1
    damage: 22,
    range: cells(70),
    cooldown: seconds(1), // rof 0: damage every frame
    defaultMode: "close",
    selectableModes: true,
    lockable: false, // verify 1.1: targetLocking false
    mechanics: {
      type: "laser",
      hitsPerSecond: 40,
      chainHops: 0,
      chainRadius: cells(CHAIN_AND_SPLASH_PX),
      reacquireDelay: seconds(LASER_REACQUIRE_FRAMES),
    },
  },
  {
    kind: "redRefractor",
    displayName: "Red Refractor",
    tree: "red",
    tier: 1,
    cost: 200,
    damage: 110,
    range: cells(80),
    cooldown: seconds(10),
    defaultMode: "close",
    selectableModes: true,
    lockable: true,
    mechanics: {
      type: "splashShot",
      splashRadius: cells(CHAIN_AND_SPLASH_PX),
      // towers 1.3: d / 50 * (50 - dist / 2), 100% at 0 px down to 50% at 50 px.
      splashEdgeFraction: 0.5,
    },
  },
  {
    kind: "purplePower1",
    displayName: "Purple Power 1",
    tree: "purple",
    tier: 1,
    cost: 300,
    damage: 2650,
    range: cells(100),
    cooldown: seconds(40),
    defaultMode: "hard",
    selectableModes: true,
    lockable: true,
    mechanics: {
      type: "chargeBeam",
      chargeSeconds: seconds(30), // towers 1.3: alpha 10 -> 100 at +3/frame
      hitsPerCycle: 1,
      slowsDuringCharge: false,
    },
  },
  {
    kind: "blueRays1",
    displayName: "Blue Rays 1",
    tree: "blue",
    tier: 1,
    cost: 300,
    damage: 500, // towers Corrections: v1.2 matches TDx (500, not v1.0's 1000)
    range: cells(70),
    cooldown: seconds(40),
    defaultMode: "fastest",
    selectableModes: false,
    lockable: false,
    mechanics: {
      type: "multiSlow",
      slots: 4,
      factor: 1 / 6, // towers 1.3 (TDx/TD2 rule, which v1.2 shares): speed = maxSpeed / 6
    },
  },
  // Row 2: Tier 2.
  {
    kind: "greenLaser2",
    displayName: "Green Laser 2",
    tree: "green",
    tier: 2,
    cost: 400,
    damage: 45,
    range: cells(70),
    cooldown: seconds(1),
    defaultMode: "close",
    selectableModes: true,
    lockable: false,
    mechanics: {
      type: "laser",
      hitsPerSecond: 40,
      chainHops: 1, // "Single bounce"
      chainRadius: cells(CHAIN_AND_SPLASH_PX),
      reacquireDelay: seconds(LASER_REACQUIRE_FRAMES),
    },
  },
  {
    kind: "littleRedSpammer",
    displayName: "Little Red Spammer",
    tree: "red",
    tier: 2,
    cost: 800,
    damage: 600, // towers Corrections: v1.2 is 600 dmg / 90 px
    range: cells(90),
    cooldown: seconds(4),
    defaultMode: "random",
    selectableModes: false,
    lockable: false,
    mechanics: {
      type: "spam",
      rocketSpeedMin: cellsPerSecond(2), // towers 1.3: rocket speed 2 -> 4 px/frame
      rocketSpeedMax: cellsPerSecond(4),
      rocketAcceleration: ROCKET_ACCELERATION,
    },
  },
  {
    kind: "purplePower2",
    displayName: "Purple Power 2",
    tree: "purple",
    tier: 2,
    cost: 900,
    damage: 8500,
    range: cells(100),
    cooldown: seconds(40),
    defaultMode: "hard",
    selectableModes: true,
    lockable: true,
    mechanics: {
      type: "chargeBeam",
      chargeSeconds: seconds(30),
      hitsPerCycle: 2, // towers 1.3: two beams at the same target, exactly 2x
      slowsDuringCharge: false,
    },
  },
  {
    kind: "blueRays2",
    displayName: "Blue Rays 2",
    tree: "blue",
    tier: 2,
    cost: 500,
    damage: 4000, // towers Corrections: v1.2 is 4000 (v1.0 was 6000)
    range: cells(80),
    cooldown: seconds(120),
    defaultMode: "fastest",
    selectableModes: false,
    lockable: false,
    mechanics: { type: "stun" },
  },
  // Row 3: Tier 3 (the fourth slot is empty in v1.2).
  {
    kind: "greenLaser3",
    displayName: "Green Laser 3",
    tree: "green",
    tier: 3,
    cost: 2000,
    damage: 200, // towers Corrections: v1.2 is 200 (v1.0 was 180)
    range: cells(70),
    cooldown: seconds(1),
    defaultMode: "close",
    selectableModes: true,
    lockable: false,
    mechanics: {
      type: "laser",
      hitsPerSecond: 40,
      chainHops: 2, // "Bounces twice"
      chainRadius: cells(CHAIN_AND_SPLASH_PX),
      reacquireDelay: seconds(LASER_REACQUIRE_FRAMES),
    },
  },
  {
    kind: "redRockets",
    displayName: "Red Rockets",
    tree: "red",
    tier: 3,
    cost: 2500,
    damage: 30000,
    range: cells(150),
    cooldown: seconds(45),
    defaultMode: "hard",
    selectableModes: true,
    lockable: true,
    mechanics: {
      type: "homingRocket",
      rocketSpeedMax: cellsPerSecond(3), // towers 1.3: speed 0 -> 3 px/frame
      rocketAcceleration: ROCKET_ACCELERATION,
    },
  },
  {
    kind: "purplePower3",
    displayName: "Purple Power 3",
    tree: "purple",
    tier: 3,
    cost: 2800,
    damage: 22000,
    range: cells(100),
    cooldown: seconds(40),
    defaultMode: "hard",
    selectableModes: true,
    lockable: true,
    mechanics: {
      type: "chargeBeam",
      chargeSeconds: seconds(30),
      hitsPerCycle: 1,
      slowsDuringCharge: true, // "Slows target": speed = maxSpeed * (100 - alpha) / 100
    },
  },
];

/** Vectoid types 1-7 of `creepName()` / `spawn()` (waves 1.1, verify 4). */
const vectoids: Readonly<Record<VectoidType, VectoidSpec>> = {
  redShredder: {
    type: "redShredder",
    displayName: "Red Shredder",
    colour: "red",
    speedMultiplier: 1,
    hpMultiplier: 1,
    damageTaken: 1,
    awardsBonusPoint: false,
  },
  blueSpinner: {
    type: "blueSpinner",
    displayName: "Blue Spinner",
    colour: "blue",
    speedMultiplier: 1,
    hpMultiplier: 1,
    damageTaken: 1,
    awardsBonusPoint: false,
  },
  greenFlyer: {
    type: "greenFlyer",
    displayName: "Green Flyer",
    colour: "green",
    speedMultiplier: 1,
    hpMultiplier: 1,
    damageTaken: 1,
    awardsBonusPoint: false,
  },
  yellowSprinter: {
    type: "yellowSprinter",
    displayName: "Yellow Sprinter",
    // Colour-neutral: 100% from every Tree (waves 1.1).
    speedMultiplier: 2, // the only fast type
    hpMultiplier: 1,
    damageTaken: 1,
    awardsBonusPoint: false,
  },
  bigPurpleBox: {
    type: "bigPurpleBox",
    displayName: "Big Purple Box",
    colour: "purple",
    speedMultiplier: 1,
    hpMultiplier: 1,
    damageTaken: 1,
    awardsBonusPoint: false,
  },
  hardGrey: {
    type: "hardGrey",
    displayName: "Hard Grey",
    // v1.2: same HP as the Wave, 75% damage from every Tower (waves 1.1).
    speedMultiplier: 1,
    hpMultiplier: 1,
    damageTaken: 0.75,
    awardsBonusPoint: false,
  },
  bonusCell: {
    type: "bonusCell",
    // v1.2 has no display name for type 6 (verify 4); this is CONTEXT.md's term.
    displayName: "Bonus Cell",
    speedMultiplier: 1,
    hpMultiplier: 4,
    damageTaken: 0.75,
    awardsBonusPoint: true,
  },
};

/** The v1.2 `levels` array (waves 1.1) mapped from creep type codes. */
const waveCodes: Readonly<Record<number, WaveEntry>> = {
  1: "redShredder",
  2: "blueSpinner",
  3: "greenFlyer",
  4: "yellowSprinter",
  5: "bigPurpleBox",
  7: "hardGrey",
  8: "mixed",
};
const levels = [
  2, 1, 2, 3, 7, 4, 2, 5, 2, 7, 2, 3, 2, 4, 7, 5, 2, 1, 2, 7, 2, 4, 2, 5, 7, 1, 2, 3, 2, 7, 4, 2, 5, 2, 7, 5, 2, 1,
  2, 7, 1, 2, 3, 2, 7, 2, 1, 2, 4, 8,
];
const waves: readonly WaveEntry[] = levels.map((code) => {
  const entry = waveCodes[code];
  if (entry === undefined) {
    throw new Error(`unknown v1.2 creep type code ${String(code)}`);
  }
  return entry;
});

export const original: Ruleset = {
  id: "original",
  version: "1.2.0",
  towers,
  vectoids,
  waves,
  bonusWaveEvery: 5, // waves 1.1: bonusEvery = 5
  economy: {
    lives: 20, // waves 4
    interest: 3, // waves 2: percentage points
    maxAliveToSend: 10, // waves 2: creepArray.length <= 10
    tiers: {
      // waves 1.2: start bank, start HP, divisor k, k step, bounty offset.
      easy: { startBank: 275, startHp: 550, hpDivisor: 5.0, hpDivisorStep: 0.03, bountyOffset: 4 },
      normal: { startBank: 275, startHp: 600, hpDivisor: 4.5, hpDivisorStep: 0.03, bountyOffset: 3 },
      hard: { startBank: 250, startHp: 625, hpDivisor: 4.2, hpDivisorStep: 0.02, bountyOffset: 2 },
    },
  },
  scoring: {
    // waves 3: kill +worth*100, leak -worth*100, send +int(bank/100*(interest*2)).
    killMultiplier: 100,
    leakMultiplier: 100,
    interestMultiplier: 2,
  },
  upgrade: {
    // towers 1.2: level max 10; each Rank int(cost/2), +int(damage/2.2), +int(range/20).
    maxRank: 10,
    costDivisor: 2,
    damageDivisor: 2.2,
    rangeDivisor: 20,
    sellPercent: 75,
  },
  bonusItems: {
    // towers 1.4
    interestIncrease: 3,
    panicLives: 5,
    boosterPercent: 25,
    boosterRadius: cells(100),
  },
  movement: {
    baseSpeed: cellsPerSecond(1), // speed 1 px/frame = 1.6 Cells/s
    spawnSpacing: cells(20), // towers 3.1: spawned 20 px apart
    /**
     * towers 1.3: slowed Vectoids recover at +0.01 px/frame per frame =
     * 0.01 x 40 x 40 / 25 = 0.64 Cells/s^2. An earlier spec quoted "0.4",
     * which converted the frame rate only once; that was a unit slip.
     */
    speedRecovery: cellsPerSecondSquared(0.01),
    vectoidsPerLane: 14, // waves 1.1: v = 1; while (v < 15)
  },
  colourRule: {
    // towers 2.1
    sameColour: 1.5,
    oppositeColour: 0.5,
  },
  variants: {
    // towers 2.2: v1.2 checks the wrong variable, so Blue never applies 50% / 75%.
    blueTowersSkipPenalties: true,
  },
};
