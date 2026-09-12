/**
 * The Classic Ruleset: Original (v1.2) plus the improvements enumerated in
 * ADR 0001 that live in data. Items 3 and 4 of that list (Max Upgrade, sticky
 * Placement) are Commands and UI behaviour, not Ruleset numbers.
 */

import { blueFrostRockets } from "./blueFrostRockets.js";
import { applyRulesetDiff } from "./diff.js";
import { original } from "./original.js";
import type { Ruleset, RulesetDiff } from "./types.js";

/** Every deviation from v1.2 that is expressed as data (ADR 0001 items 1, 2). */
export const classicDiff: RulesetDiff = {
  id: "classic",
  version: "1.0.0",
  variants: {
    // ADR 0001 item 1: Blue Towers obey the colour rule.
    blueTowersSkipPenalties: false,
  },
  // ADR 0001 item 2: the Blue Tier 3.
  addTowers: [blueFrostRockets],
};

export const classic: Ruleset = applyRulesetDiff(original, classicDiff);
