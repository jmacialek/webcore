/**
 * Applying a RulesetDiff (ADR 0001): a derived Ruleset is its base plus an
 * explicit, reviewable list of changes, never edited data.
 */

import type { Ruleset, RulesetDiff } from "./types.js";

/**
 * Pure: returns a new Ruleset and leaves `base` untouched. Added Towers are
 * appended after the base roster; variants merge over the base's; id and
 * version come from the diff.
 *
 * @throws Error if `diff.addTowers` repeats a kind the base already has.
 */
export function applyRulesetDiff(base: Ruleset, diff: RulesetDiff): Ruleset {
  const added = diff.addTowers ?? [];
  for (const spec of added) {
    if (base.towers.some((t) => t.kind === spec.kind)) {
      throw new Error(`Ruleset ${base.id} already has a Tower of kind ${spec.kind}`);
    }
  }
  return {
    ...base,
    id: diff.id,
    version: diff.version,
    towers: [...base.towers, ...added],
    variants: { ...base.variants, ...diff.variants },
  };
}
