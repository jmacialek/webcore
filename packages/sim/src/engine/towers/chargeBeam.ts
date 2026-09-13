import type { TowerBehaviour } from "./behaviour.js";
import { TICKS_PER_SECOND } from "../../types.js";

interface ChargeBeamState {
  /** Ticks from one cycle start to the next (1 s). */
  periodTicks: number;
  /** Ticks the beam charges before the hit (0.75 s). */
  chargeTicks: number;
  hitsPerCycle: number;
  slowsDuringCharge: boolean;
  /** Charge ticks completed in the running cycle; -1 when no cycle is running. */
  charged: number;
}

/**
 * Purple Powers: on a one-second cycle, pick a target (Target Lock rules)
 * and charge a beam at it for 0.75 s, then land `hitsPerCycle` full hits
 * in that one tick; the rest of the cycle is idle (towers research 1.3;
 * v1.2 verification 1.3).
 *
 * Charge model: on charge tick k of N the beam's charge is (k + 1) / N, a
 * linear ramp from 1 / N to exactly 1 on the boundary tick. (The original
 * stepped alpha 10 -> 100 in +3 per frame over 30 frames; the ramp here
 * keeps the same duration and endpoint at 120 ticks/s without the 10%
 * head start.) Purple Power 3 sets its target's speed to
 * maxSpeed x (1 - charge) on every charge tick, so it stops on the boundary
 * tick and recovers at the Ruleset's rate afterwards.
 *
 * If the target dies or leaves Range mid-charge the cycle aborts with no
 * hit and a fresh cycle starts the next tick (the original retried the next
 * frame when nothing was in Range, and dropped a beam whose target left).
 */
export const chargeBeamBehaviour: TowerBehaviour<ChargeBeamState> = {
  init(spec) {
    if (spec.mechanics.type !== "chargeBeam") throw new Error("chargeBeam behaviour on wrong tower");
    return {
      periodTicks: Math.round(spec.cooldown * TICKS_PER_SECOND),
      chargeTicks: Math.round(spec.mechanics.chargeSeconds * TICKS_PER_SECOND),
      hitsPerCycle: spec.mechanics.hitsPerCycle,
      slowsDuringCharge: spec.mechanics.slowsDuringCharge,
      charged: -1,
    };
  },

  tick(tower, s, engine) {
    if (tower.cooldownTicks > 0) {
      tower.cooldownTicks -= 1;
      return;
    }
    let target;
    if (s.charged >= 0) {
      target = engine.heldTarget(tower);
      if (target === null) {
        // Died or left Range mid-charge: abort; a new cycle starts next tick.
        tower.targetId = null;
        s.charged = -1;
        return;
      }
    } else {
      target = engine.resolveTarget(tower);
      if (target === null) return; // nothing in Range: retry next tick
      s.charged = 0;
    }

    const charge = (s.charged + 1) / s.chargeTicks;
    engine.addBeam(tower.id, [target.id], charge);
    if (s.slowsDuringCharge) engine.slow(target, target.maxSpeed * (1 - charge), 0);
    s.charged += 1;
    if (s.charged < s.chargeTicks) return;

    // The boundary tick: every hit of the cycle lands now.
    const d = engine.damageAgainst(tower, target.type);
    for (let i = 0; i < s.hitsPerCycle; i += 1) engine.dealDamage(target, d, tower.id);
    if (!target.alive) tower.targetId = null;
    s.charged = -1;
    tower.cooldownTicks = s.periodTicks - s.chargeTicks;
  },
};
