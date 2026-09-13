import { isOnGrid } from "../map/lane.js";
import type { Cell } from "../map/types.js";
import type { SelectableMode, TowerKind } from "../ruleset/types.js";
import type { BoosterKind, Command, CommandResult, InstantBonusItem, RejectReason } from "../types.js";
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

const SELECTABLE_MODES = new Set<string>(["close", "hard", "weak"]);
const BONUS_ITEMS = new Set<string>(["interestIncrease", "panic"]);
const BOOSTER_KINDS = new Set<string>(["damageBooster", "rangeBooster"]);

function reject(reason: RejectReason): CommandResult {
  return { ok: false, reason };
}

const OK: CommandResult = Object.freeze({ ok: true });

type Raw = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** A fresh Cell from a raw one; non-integer coordinates pass here and fail `checkCell` as off-Grid. */
function copyCell(value: unknown): Cell | null {
  if (!isRecord(value) || typeof value["col"] !== "number" || typeof value["row"] !== "number") return null;
  return { col: value["col"], row: value["row"] };
}

/**
 * Validate the shape of a raw Command and return a fresh copy holding only
 * its known fields, or null when it is not a Command. The copy shares
 * nothing with the caller's object, so the Command Log can never be
 * rewritten from outside (ADR 0003). Semantic checks (a known Tower kind,
 * an existing Tower) are `applyCommand`'s.
 */
export function normaliseCommand(raw: unknown): Command | null {
  if (!isRecord(raw) || !isInteger(raw["tick"])) return null;
  const tick = raw["tick"];
  switch (raw["type"]) {
    case "placeTower": {
      const cell = copyCell(raw["cell"]);
      if (typeof raw["kind"] !== "string" || cell === null) return null;
      return { type: "placeTower", tick, kind: raw["kind"] as TowerKind, cell };
    }
    case "upgrade":
    case "upgradeToMax":
    case "sell":
      if (!isInteger(raw["towerId"])) return null;
      return { type: raw["type"], tick, towerId: raw["towerId"] };
    case "setTargetingMode":
      if (!isInteger(raw["towerId"]) || typeof raw["mode"] !== "string" || !SELECTABLE_MODES.has(raw["mode"])) return null;
      return { type: "setTargetingMode", tick, towerId: raw["towerId"], mode: raw["mode"] as SelectableMode };
    case "setTargetLock":
      if (!isInteger(raw["towerId"]) || typeof raw["lock"] !== "boolean") return null;
      return { type: "setTargetLock", tick, towerId: raw["towerId"], lock: raw["lock"] };
    case "sendWave":
      return { type: "sendWave", tick };
    case "setAuto":
      if (typeof raw["enabled"] !== "boolean") return null;
      return { type: "setAuto", tick, enabled: raw["enabled"] };
    case "useBonusItem":
      if (typeof raw["item"] !== "string" || !BONUS_ITEMS.has(raw["item"])) return null;
      return { type: "useBonusItem", tick, item: raw["item"] as InstantBonusItem };
    case "placeBooster": {
      const cell = copyCell(raw["cell"]);
      if (typeof raw["kind"] !== "string" || !BOOSTER_KINDS.has(raw["kind"]) || cell === null) return null;
      return { type: "placeBooster", tick, kind: raw["kind"] as BoosterKind, cell };
    }
    default:
      return null;
  }
}

function checkCell(engine: Engine, cell: Cell): RejectReason | null {
  if (!Number.isInteger(cell.col) || !Number.isInteger(cell.row) || !isOnGrid(cell)) return "cellOffGrid";
  if (engine.map.isCorridor(cell)) return "cellIsCorridor";
  if (engine.isCellOccupied(cell)) return "cellOccupied";
  return null;
}

/** A fresh copy of a Command known to be well-formed (one the sim itself built). */
export function copyCommand(command: Command): Command {
  const copy = normaliseCommand(command);
  if (copy === null) throw new Error(`logged Command is malformed: ${JSON.stringify(command)}`);
  return copy;
}

/**
 * Validate and apply one well-formed Command (see `normaliseCommand`) at the
 * start of the Engine's current tick. Either applies fully or rejects with
 * a reason and no state change. The tick is checked before the ended state
 * so a stale Command is never recorded as a `runEnded` rejection that a
 * replay, reaching that tick with the Run still live, would then accept.
 */
export function applyCommand(engine: Engine, command: Command): CommandResult {
  if (command.tick !== engine.tick) return reject("outOfOrderTick");
  if (engine.ended) return reject("runEnded");

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
