import { isOnGrid } from "../map/lane.js";
import type { Cell } from "../map/types.js";
import type { Command, CommandResult, RejectReason } from "../types.js";
import type { Engine } from "./engine.js";

const TOWER_KINDS = new Set<string>([
  "greenLaser1",
  "greenLaser2",
  "greenLaser3",
  "redRefractor",
  "littleRedSpammer",
  "redRockets",
  "purplePower1",
  "purplePower2",
  "purplePower3",
  "blueRays1",
  "blueRays2",
  "blueFrostRockets",
]);

function reject(reason: RejectReason): CommandResult {
  return { ok: false, reason };
}

const OK: CommandResult = { ok: true };

function checkCell(engine: Engine, cell: Cell): RejectReason | null {
  if (!Number.isInteger(cell.col) || !Number.isInteger(cell.row) || !isOnGrid(cell)) return "cellOffGrid";
  if (engine.map.isCorridor(cell)) return "cellIsCorridor";
  if (engine.isCellOccupied(cell)) return "cellOccupied";
  return null;
}

/**
 * Validate and apply one Command at the start of the Engine's current tick.
 * Either applies fully or rejects with a reason and no state change.
 */
export function applyCommand(engine: Engine, command: Command): CommandResult {
  if (engine.ended) return reject("runEnded");
  if (command.tick !== engine.tick) return reject("outOfOrderTick");

  switch (command.type) {
    case "placeTower": {
      if (!TOWER_KINDS.has(command.kind)) return reject("unknownTowerKind");
      const spec = engine.towerSpec(command.kind);
      if (spec === null) return reject("towerNotInRuleset");
      const cellProblem = checkCell(engine, command.cell);
      if (cellProblem !== null) return reject(cellProblem);
      if (engine.bank < spec.cost) return reject("unaffordable");
      engine.placeTower(spec, { col: command.cell.col, row: command.cell.row });
      return OK;
    }
    case "upgrade": {
      const tower = engine.findTower(command.towerId);
      if (tower === null) return reject("noSuchTower");
      if (tower.rank >= engine.ruleset.upgrade.maxRank) return reject("maxRank");
      const cost = engine.upgradeCost(tower);
      if (engine.bank < cost) return reject("unaffordable");
      tower.rank += 1;
      tower.spend += cost;
      engine.bank -= cost;
      engine.pendingEvents.push({ type: "towerUpgraded", tick: engine.tick, towerId: tower.id, rank: tower.rank, cost });
      return OK;
    }
    case "upgradeToMax": {
      const tower = engine.findTower(command.towerId);
      if (tower === null) return reject("noSuchTower");
      if (tower.rank >= engine.ruleset.upgrade.maxRank) return reject("maxRank");
      const quote = engine.quoteMaxUpgrade(tower);
      if (quote.ranks === 0) return reject("unaffordable");
      const step = engine.upgradeCost(tower);
      for (let i = 0; i < quote.ranks; i += 1) {
        tower.rank += 1;
        tower.spend += step;
        engine.bank -= step;
        engine.pendingEvents.push({ type: "towerUpgraded", tick: engine.tick, towerId: tower.id, rank: tower.rank, cost: step });
      }
      return OK;
    }
    case "sell": {
      const tower = engine.findTower(command.towerId);
      if (tower === null) return reject("noSuchTower");
      const refund = engine.sellValue(tower.spend);
      engine.bank += refund;
      engine.removeTower(tower);
      engine.pendingEvents.push({ type: "towerSold", tick: engine.tick, towerId: tower.id, refund });
      return OK;
    }
    case "setTargetingMode": {
      const tower = engine.findTower(command.towerId);
      if (tower === null) return reject("noSuchTower");
      if (!tower.spec.selectableModes) return reject("modeNotSelectable");
      tower.mode = command.mode;
      // The original always dropped the held target so the new mode takes effect at once.
      tower.targetId = null;
      return OK;
    }
    case "setTargetLock": {
      const tower = engine.findTower(command.towerId);
      if (tower === null) return reject("noSuchTower");
      if (!tower.spec.lockable) return reject("notLockable");
      tower.lock = command.lock;
      return OK;
    }
    case "sendWave": {
      if (!engine.canSend) return reject("sendUnavailable");
      engine.send();
      return OK;
    }
    case "setAuto": {
      engine.auto = command.enabled;
      if (command.enabled && engine.vectoids.length === 0 && engine.canSend) engine.send();
      return OK;
    }
    case "useBonusItem": {
      if (engine.bonusPoints < 1) return reject("noBonusPoints");
      engine.bonusPoints -= 1;
      if (command.item === "interestIncrease") engine.interest += engine.ruleset.bonusItems.interestIncrease;
      else engine.lives += engine.ruleset.bonusItems.panicLives;
      engine.pendingEvents.push({ type: "bonusItemUsed", tick: engine.tick, item: command.item });
      return OK;
    }
    case "placeBooster": {
      if (engine.bonusPoints < 1) return reject("noBonusPoints");
      const cellProblem = checkCell(engine, command.cell);
      if (cellProblem !== null) return reject(cellProblem);
      engine.placeBooster(command.kind, { col: command.cell.col, row: command.cell.row });
      return OK;
    }
  }
}
