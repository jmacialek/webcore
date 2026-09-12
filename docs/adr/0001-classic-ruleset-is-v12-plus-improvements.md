---
status: accepted
date: 2026-09-12
---
# Classic ruleset is Vector TD v1.2 plus enumerated improvements

The default Ruleset, Classic, reproduces the decompiled Vector TD v1.2 numbers
(see `docs/research/`) and then applies a short, explicit list of
improvements: the Blue tree's colour-rule bug is fixed, Blue Frost Rockets is
added as the Blue Tier 3, and Target Locking is kept. A pure v1.2 Ruleset,
Original, exists only as a sim test fixture and is never selectable in the
game. We chose this over a pixel-faithful default because the owner wants a
holistic upgrade and over a free redesign because the v1.2 economy and wave
table are the thing veterans recognise.

## Consequences

- Every further deviation from v1.2 is added to the list in this ADR, not
  slipped into the data.
- Scores are only comparable within a Ruleset version; Classic is versioned.

## Improvements over v1.2

1. Blue towers obey the colour rule (50% to Purple, 75% to Hard Grey). The
   original checked the wrong variable and never applied it.
2. Blue Frost Rockets: Blue Tier 3, long range, splash slow on impact,
   player-selectable Targeting Mode. Numbers set by a balancing prototype.
3. Max Upgrade: one `upgradeToMax` command raises a Tower as many Ranks as
   the Bank allows, up to Rank 10; the button label shows the cost of what
   the click will do. The original required one click per Rank.
4. Sticky Placement: after placing a Tower or Booster the same kind stays on
   the cursor until cancelled by Escape, right-click, clicking its sidebar
   card again, or selecting a placed Tower. If the Bank cannot cover the
   next one the ghost stays and shows as unaffordable. Each placement is its
   own `placeTower` command. The original dropped the selection after every
   placement.
