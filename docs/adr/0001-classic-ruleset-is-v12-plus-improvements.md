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
   player-selectable Targeting Mode. $2,200; damage 5,000 per victim; Range
   6.0 Cells; one rocket every 3 s; the impact halves the speed (factor 1/2)
   of every Vectoid within 1.5 Cells and holds it there for 1 s before the
   usual recovery. Chosen with the sim's balancing harness by playing the
   same Refractor economy with two Red Rockets, two Frost Rockets, and one
   of each at equal spend: these numbers leave the Frost build level with
   the Red build in Waves survived (25 against 24) while Leaking nothing on
   the Yellow Sprinter Waves it meets (Red Leaks 13), and make the mixed
   build outlast both (36 Waves).
3. Max Upgrade: one `upgradeToMax` command raises a Tower as many Ranks as
   the Bank allows, up to Rank 10; the button label shows the cost of what
   the click will do. The original required one click per Rank.
4. Sticky Placement: after placing a Tower or Booster the same kind stays on
   the cursor until cancelled by Escape, right-click, clicking its sidebar
   card again, or selecting a placed Tower. If the Bank cannot cover the
   next one the ghost stays and shows as unaffordable. Each placement is its
   own `placeTower` command. The original dropped the selection after every
   placement.
