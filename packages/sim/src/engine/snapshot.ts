import type { NextWavePreview, Snapshot, TowerSnapshot, VectoidSnapshot } from "../types.js";
import { waveComposition, waveStats } from "../ruleset/waves.js";
import type { Engine } from "./engine.js";

function nextWavePreview(engine: Engine): NextWavePreview | null {
  const wave = engine.nextWave();
  if (wave === null) return null;
  const entry = engine.ruleset.waves[wave - 1];
  if (entry === undefined) return null;
  const stats = waveStats(engine.ruleset, engine.map.tier, wave);
  const displayName = entry === "mixed" ? "All types" : engine.ruleset.vectoids[entry].displayName;
  const bonus = waveComposition(engine.ruleset, wave).includes("bonusCell");
  return { wave, entry, displayName, hp: stats.hp, bounty: stats.bounty, bonus };
}

function towerSnapshot(engine: Engine, t: (typeof engine.towers)[number]): TowerSnapshot {
  const atMax = t.rank >= engine.ruleset.upgrade.maxRank;
  return {
    id: t.id,
    kind: t.kind,
    cell: t.cell,
    rank: t.rank,
    damage: engine.buffedDamage(t),
    range: engine.buffedRange(t),
    baseDamage: engine.baseDamage(t),
    baseRange: engine.baseRange(t),
    cooldown: t.spec.cooldown,
    mode: t.mode,
    selectableModes: t.spec.selectableModes,
    lockable: t.spec.lockable,
    lock: t.lock,
    targetId: engine.findVectoid(t.targetId) === null ? null : t.targetId,
    spend: t.spend,
    sellValue: engine.sellValue(t.spend),
    upgradeCost: atMax ? null : engine.upgradeCost(t),
    maxUpgrade: engine.quoteMaxUpgrade(t),
    damageBuff: t.damageBuff,
    rangeBuff: t.rangeBuff,
  };
}

function vectoidSnapshot(v: (typeof Engine.prototype.vectoids)[number]): VectoidSnapshot {
  return {
    id: v.id,
    type: v.type,
    wave: v.wave,
    lane: v.lane,
    distance: v.distance,
    x: v.x,
    y: v.y,
    hp: v.hp,
    maxHp: v.maxHp,
    speed: v.speed,
    maxSpeed: v.maxSpeed,
    bounty: v.bounty,
  };
}

export function buildSnapshot(engine: Engine): Snapshot {
  return {
    tick: engine.tick,
    rulesetId: engine.ruleset.id,
    rulesetVersion: engine.ruleset.version,
    mapId: engine.map.id,
    tier: engine.map.tier,
    seed: engine.seed,
    economy: {
      bank: engine.bank,
      lives: engine.lives,
      interest: engine.interest,
      score: engine.score,
      bonusPoints: engine.bonusPoints,
    },
    wave: {
      current: engine.wave,
      total: engine.totalWaves,
      alive: engine.vectoids.length,
      canSend: engine.canSend,
      auto: engine.auto,
      next: nextWavePreview(engine),
    },
    vectoids: engine.vectoids.map(vectoidSnapshot),
    towers: engine.towers.map((t) => towerSnapshot(engine, t)),
    boosters: engine.boosters.map((b) => ({ id: b.id, kind: b.kind, cell: b.cell })),
    projectiles: engine.projectiles.map((p) => ({
      id: p.id,
      kind: p.kind,
      towerId: p.towerId,
      targetId: p.targetId,
      x: p.x,
      y: p.y,
      speed: p.speed,
    })),
    beams: engine.beams,
    outcome: engine.outcome,
  };
}
