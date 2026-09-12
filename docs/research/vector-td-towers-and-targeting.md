# Vector TD / Vector TDx / Vector TD 2 -- towers, colour rule, targeting

Research notes for the Vector 3D tribute. Compiled 2026-09-12.

## Summary

The three Candystand Flash builds (Vector TD, June 2007; Vector TDx, October 2007;
Vector TD 2, January 2008) are preserved on archive.org. All three SWFs were downloaded and
decompiled with JPEXS (AS2 source), so almost every number below is read directly from the
game code rather than from secondary sources. Where a web source also quotes the number it is
noted, but the code is the primary reference.

Headline findings:

- There are **9 damage towers** in Vector TD (3 green, 3 red, 3 purple) plus **2 blue** slow/stun
  towers, and **4 bonus-point items** (Damage Booster, Range Booster, Interest Increase, Panic!).
  Vector TDx and TD 2 add one more tower, the **Rewinder**.
- Every tower has **10 levels**. Each upgrade costs a flat `int(baseCost / 2)`, adds
  `int(baseDamage / 2.2)` damage and `int(baseRange / 20)` range. Same formula in all three builds.
- **Colour rule**: a tower does **150%** to the vectoid of its own colour and **50%** to one
  "opposing" colour (green<->red, purple<->blue). Everything else takes 100%. There is **no
  immunity** anywhere. In TDx/TD 2 (not v1) Hard Grey and the bonus power cell additionally take
  **75%** from every tower. A code bug means **blue towers never apply their 50%/75% penalties**.
- **Targeting**: CLOSE = minimum Euclidean distance, HARD = highest current HP, WEAK = lowest
  current HP; ties go to the earliest-spawned vectoid (the pack leader). Little Red Spammer is
  fixed to RANDOM, Blue Rays and Rewinder to FASTEST.
- **Target Locking**: v1 has no toggle -- periodic towers always keep a target until it dies or
  leaves range. TDx and TD 2 add an ON/OFF toggle (default ON) on Red Refractor, Red Rockets and
  the three Purple Powers; OFF re-runs target selection before every shot.

Confidence legend: **confirmed** = read from decompiled game code (and usually echoed by a web
source); **single-source** = one web source only, not verifiable in code; **unknown** = not found.

Unit notes: the SWFs run at **40 fps**; `rof` values are in frames. Playfield is 550 x 450 px,
grid cells are 25 px (22 x 18 cells). Range is in px measured from the tower centre.

---

## 1. Tower roster

### 1.1 Base stats (confirmed, from tower scripts in all three SWFs)

| Tower (in-game title) | Colour | Cost | Damage (v1) | Damage (TDx / TD2) | Range px (cells) | `rof` frames -> rate | Default target mode | Description string |
|---|---|---|---|---|---|---|---|---|
| GREEN LASER 1 | green | $100 | 22 | 22 | 70 (2.8) | 0 -> every frame, 40/s | closest | (none) |
| GREEN LASER 2 | green | $400 | 45 | 45 | 70 (2.8) | 0 -> 40/s | closest | "Single bounce" (shop) |
| GREEN LASER 3 | green | $2000 | **180** | **200** | 70 (2.8) | 0 -> 40/s | closest | "Bounces twice" (shop) |
| RED REFRACTOR | red | $200 | 110 | 110 | 80 (3.2) | 10 -> 4/s | closest | "Splash damage" |
| LITTLE RED SPAMMER | red | $800 | **400** | **600** | **80** / **90** (3.2 / 3.6) | fixed 4 -> 10 rockets/s | random (fixed) | "Multiple random targets" |
| RED ROCKETS | red | $2500 | 30000 | 30000 | 150 (6.0) | 45 -> 0.89/s | hardest | "Two targets at a time" |
| PURPLE POWER 1 | purple | $300 | 2650 | 2650 | 100 (4.0) | 40 -> 1/s | hardest | (none) |
| PURPLE POWER 2 | purple | $900 | 8500 x 2 beams | 8500 x 2 | 100 (4.0) | 40 -> 1/s | hardest | (none) |
| PURPLE POWER 3 | purple | $2800 | 22000 | 22000 | 100 (4.0) | 40 -> 1/s | hardest | "Slows target" |
| BLUE RAYS 1 | blue | $300 | **1000** | **500** | 70 (2.8) | 40 -> 1/s (up to 4 targets) | fastest (fixed) | "Slows multiple targets" |
| BLUE RAYS 2 | blue | $500 | **6000** | **4000** | 80 (3.2) | 120 -> 1 per 3 s | fastest (fixed) | "Stuns target" |
| REWINDER (TDx, TD2 only) | -- | $1300 | 0 | 0 | 65 (2.6) | 100 -> 1 per 2.5 s | fastest (fixed) | "Moves target back in time" |

Sprite names in the code: `tower_green/green2/green3`, `tower_brown` (Refractor), `tower_swarm`
(Spammer), `tower_red` (Rockets), `tower_pink1/2/3` (Purple), `tower_blue` (Blue 1),
`tower_bash` (Blue 2), `tower_rewind`, `tower_buff1` (Damage Booster), `tower_buff2` (Range
Booster). Costs are identical in all three builds; only the bolded damage/range values differ.

Web corroboration: The Hidden Blade (TDx) quotes Green Laser 1 $100 / 22 dmg / 40 shots per
second / 880 DPS, Purple Power 2 $900 / 8500 x 2 = 17000 DPS, Red Refractor $200, Little Red
Spammer $800 / 600, Red Rockets $2500 / 30000, Purple 1 $300 / 2650, Purple 3 $2800 / 22000 --
all match the TDx code. Jay is Games reader comments quote Green $100 and Blue Ray 1 $300 (match)
but "Red Laser I $150" (does not match any build; single-source, treated as wrong).

### 1.2 Upgrades (confirmed; `upgrade()` is byte-identical in v1 and TD2)

```
if (bank >= int(baseCost/2)) {
  level  += 1;                       // max level 10 -> 9 upgrades
  damage += int(baseDamage / 2.2);
  range  += int(baseRange / 20);
  cost   += int(baseCost / 2);       // cumulative value, used for sell price
  bank   -= int(baseCost / 2);
}
sell(): bank += int(cost / 100 * 75)   // 75% of everything spent on that tower
```

Fire rate never changes with level. Total spend to level 10 = 5.5 x base cost.

| Tower | Upgrade cost (each) | +dmg / lvl | +range / lvl | Dmg at L10 (v1) | Dmg at L10 (TDx/TD2) | Range at L10 |
|---|---|---|---|---|---|---|
| Green Laser 1 | $50 | 10 | 3 | 112 | 112 | 97 |
| Green Laser 2 | $200 | 20 | 3 | 225 | 225 | 97 |
| Green Laser 3 | $1000 | 81 / 90 | 3 | 909 | 1010 | 97 |
| Red Refractor | $100 | 50 | 4 | 560 | 560 | 116 |
| Little Red Spammer | $400 | 181 / 272 | 4 | 2029 | 3048 | 116 / 126 |
| Red Rockets | $1250 | 13636 | 7 | 152724 | 152724 | 213 |
| Purple Power 1 | $150 | 1204 | 5 | 13486 | 13486 | 145 |
| Purple Power 2 | $450 | 3863 | 5 | 43267 (x2 beams) | 43267 (x2) | 145 |
| Purple Power 3 | $1400 | 10000 | 5 | 112000 | 112000 | 145 |
| Blue Rays 1 | $150 | 454 / 227 | 3 | 5086 | 2543 | 97 |
| Blue Rays 2 | $250 | 2727 / 1818 | 4 | 30543 | 20362 | 116 |
| Rewinder | $650 | 0 | 3 | -- | -- | 92 |

(L10 values computed from the formula; the formula itself is confirmed.)

### 1.3 Per-tower firing mechanics (confirmed, from tower scripts and `fire()`)

- **Green Laser 1/2/3** (`fire` types 1 / 1.2 / 1.3): continuous beam, damage applied every
  frame while the target is in range and on screen. If the target is lost the tower waits 10
  frames before re-scanning. GL2 chains once and GL3 twice to another vectoid within 50 px of
  the previous one; every hop takes the full (colour-adjusted) damage. Shop text: "damage 2 [3]
  vectoids at a time, both [all] targets take equal damage".
- **Red Refractor** (type 3): 1 shot / 10 frames. Primary target takes full damage; every other
  vectoid within 50 px takes `d / 50 * (50 - dist/2)`, i.e. 100% at 0 px falling linearly to
  50% at 50 px.
- **Little Red Spammer** (type 8): every 4 frames launches one small rocket at a uniformly
  random vectoid in range (spawns from a random point on the tower). Rocket speed 2 -> 4 px/frame.
  If its target dies the rocket self-destructs (no retarget). Not affected by the mode buttons.
- **Red Rockets** (type 2): every 45 frames the tower's script calls `fire()` once, creating one
  homing "rocket" clip (speed 0 -> 3 px/frame, +0.1/frame). If the rocket's target dies in
  flight it retargets the nearest on-screen vectoid; if none, it explodes harmlessly. The shop
  text says "Fires 2 heat seaking rockets"; the description string is "Two targets at a time".
  Whether the `rocket` clip visually contains two missiles was not checked (**unknown**); the
  code applies damage once per `fire()` call. The Hidden Blade's claim that a Red Rockets tower
  "won't fire a third" while two are in the air was **not found in the code** (single-source).
- **Purple Power 1/2/3** (types 5 / 5.2 / 5.3): beam charges for 30 frames (alpha 10 -> 100 at
  +3/frame) then dumps the full damage in one hit; next cycle 40 frames after the previous
  start. PP2 fires two beams at the same target (hence "more than twice the damage" in the shop
  text -- in code it is exactly 2x). PP3 decelerates the target during the charge:
  `speed = maxSpeed * (100 - alpha) / 100`, reaching 0 at full charge.
- **Blue Rays 1** (type 4): once per 40 frames hits up to 4 vectoids. v1 only picks vectoids
  with `speed > maxSpeed / 1.2` (not already slowed) and sets `speed = maxSpeed / 8`. TDx/TD2
  first fill the 4 slots with vectoids at full speed, then any others in range, and set
  `speed = maxSpeed / 6` (only if that is slower than the current speed). Vectoids recover speed
  at +0.01 px/frame (so a slowed 1.0 px/frame vectoid takes ~87 frames (v1) / ~83 frames (TD2)
  to recover, ~2 s). Selection order is creep array order (spawn order).
- **Blue Rays 2** (type 9): once per 120 frames targets the single fastest vectoid in range.
  v1 sets `speed = -0.2` (pushed slightly backwards, ~20 frames to stop, then recovers), TD2
  `speed = -0.5` (~50 frames), TDx `speed = 0` (pure stop). Shop text: "stop dead for a second
  or 2 while it re-boots".
- **Rewinder** (type 13, TDx/TD2): every 100 frames targets the fastest vectoid in range that
  has not already been rewound (`doRewind == 0`); the vectoid is teleported back
  `int(range / 4.5) + 2` entries in its position history, which is sampled every 10 frames --
  16 entries (160 frames, 4.0 s of travel) at L1 up to 22 entries (220 frames, 5.5 s) at L10 --
  and can never be rewound again. Does no damage.

### 1.4 Bonus-point items (confirmed; shop rollover text and handlers)

Bonus points ("ups" in code) are earned by killing the bonus power cell (creep type 6) that
spawns as the 14th vectoid on the last path of every 5th wave (v1, TD2; every 10th in TDx).
Each item costs 1 bonus point.

| Item (shop title) | Effect (code) | Shop text |
|---|---|---|
| DAMAGE BOOSTER | Placed like a tower (`Type = "buffD"`). Every damage tower whose origin is < 100 px (4 cells) away gets `damageBuff += 25` (additive; two boosters = +50%). Recomputed whenever a tower is placed/removed. | "Increase the damage of all towers in range by 25%" |
| RANGE BOOSTER | Same, `rangeBuff += 25`. | "Increase the range of all towers in range by 25%" |
| INTEREST INCREASE | `interest += 3` (percentage points). Not placed. | "Increases the interest rate by 3% ... Interest is earned each time you send a wave." |
| PANIC! | `lives += 5`. Not placed. | "This item will give you 5 extra lives." |

Mapping to the icon names in the kickoff brief (**inferred**, not from code): the "dollar" icon
is INTEREST INCREASE; the "rocket" is the ordinary $2500 RED ROCKETS tower; the "atom"-looking
icon is most likely the $200 RED REFRACTOR (a normal tower, not a bonus item); "spiked green"
is probably GREEN LASER 3. Confirm against the sprites before relying on this.

### 1.5 Economy constants (confirmed)

| | Vector TD (v1) | Vector TDx | Vector TD 2 (Normal) |
|---|---|---|---|
| Starting bank | $250 | $275 | $275 |
| Lives | 20 | 20 | 20 |
| Base interest | 3%, paid on the bank at the moment each wave is released (incl. wave 1) | 3% | 3% |
| Kill reward | `baseWorth` = 3 on wave 1, +1 per wave | 3, +1 | 4, +1 |
| Waves | 40 (last is a mixed wave) | 50 | 50 |
| Vectoids per path per wave | 14 | 14 | 14 |
| Base HP | 550 (maps 1-4) / 650 (maps 5-8) | 850 | 600 |
| HP growth per wave | `+int(HP/6)` (maps 1-4) / `+int(HP/5)` (maps 5-8) | `+int(HP*inc/100)`, inc starts 9, +0.8/wave | `+int(HP/inc)`, inc starts 4.5, +0.03/wave (maps <= 5) or +0.02 |
| Hard Grey HP | 1.5 x base | 1 x base | 1 x base |
| Bonus power cell HP | 6 x base (1.5 x 4) | 4 x base | 4 x base |
| Bonus wave interval | every 5 | every 10 | every 5 |
| Sell value | 75% | 75% | 75% |

v1 wave order (`levels`, creep type ids): `2,1,2,3,7,4,2,5,2,7,2,3,2,4,7,5,2,1,2,7,2,4,2,5,7,1,2,3,2,7,4,2,5,2,7,5,2,1,2,8`
(1 Red Shredder, 2 Blue Spinner, 3 Green Flyer, 4 Yellow Sprinter, 5 Big Purple Box, 7 Hard
Grey, 8 mixed). TD2 Normal uses the same first 40 entries plus `7,1,2,3,2,7,2,1,2,4,8`.
The Grokipedia summary "about 40% blue, 20% grey, 10% each of the others" is consistent with this.

---

## 2. Colour rule

### 2.1 Multipliers (confirmed; `fire()` in all three builds, and the shop rollover strings)

Vectoid type ids: 1 Red Shredder, 2 Blue Spinner, 3 Green Flyer, 4 Yellow Sprinter (speed 2 vs 1),
5 Big Purple Box, 6 bonus power cell, 7 Hard Grey, 9 Orange Regener / 10 Orange Spurter (TDx only).

| Tower colour | 150% vs | 50% vs | 75% vs (TDx / TD2 only) | 100% vs |
|---|---|---|---|---|
| Green (GL1-3) | Green Flyer | Red Shredder | Hard Grey, bonus cell | everything else |
| Red (Refractor, Spammer, Rockets) | Red Shredder | Green Flyer | Hard Grey, bonus cell | everything else |
| Purple (PP1-3) | Big Purple Box | Blue Spinner | Hard Grey, bonus cell | everything else |
| Blue (BR1, BR2) | Blue Spinner | Big Purple Box *(intended -- see bug)* | Hard Grey, bonus cell *(intended)* | everything else |

Shop strings say exactly: "150% damage to green / 50% to red vectoids" (green towers),
"150% damage to red / 50% to green vectoids" (red), "150% damage to purple / 50% to blue
vectoids" (purple), "150% damage to blue / 50% to purple vectoids" (blue). Jay is Games and
its comments repeat the same 150% / 50% pairs.

Mechanics of the rule:

- The multiplier is applied per hit, after the tower's own `damage` and Damage Booster bonus:
  `d = buffedDamage; if (target.Type == own) d = d/100*150; else if (target.Type == opposite) d = d/100*50;`
  (TDx/TD2 add `else if (Type == 6 || Type == 7) d = d/100*75`).
- It is a plain multiplier; there is no immunity, no armour subtraction, no colour-typed HP.
- Yellow Sprinter and (in v1) Hard Grey / bonus cell take 100% from all colours.
- Refractor splash, Green 2/3 bounces and Purple 3's slow use the *primary* target's colour
  for the multiplier and then apply that `d` to every secondary victim; secondaries' own colours
  are **not** consulted.
- "Hard Grey" vectoids in v1 are simply 1.5x HP and colour-neutral. In TDx/TD2 they have base
  HP but take 75% from everything. In all builds the bonus power cell rides along in the Hard
  Grey wave with 4x (v1: 6x) HP and 100% (v1) / 75% (TDx, TD2) damage taken.

### 2.2 Blue-tower bug (confirmed in v1, TDx and TD2)

In the Blue Rays branches (`Type == 4` and `Type == 9`) the second and third checks read
`this.targ.Type` instead of `too.Type`:

```
if(too.Type == 2)            { d = d / 100 * 150; }
else if(this.targ.Type == 5) { d = d / 100 * 50;  }   // this.targ is undefined here
else if(this.targ.Type == 6 || this.targ.Type == 7) { d = d / 100 * 75; }   // TDx/TD2
```

`fire()` is called on the game object, where `this.targ` is undefined, so the 50%-to-purple and
75%-to-grey penalties never trigger for blue towers. Net effect: Blue Rays do 150% to Blue
Spinner and 100% to everything else. A tribute that wants "as designed" behaviour should apply
50% / 75%; one that wants "as shipped" should not.

### 2.3 What the sources call "colour immunity / resistance"

No source that quotes numbers describes an immunity. Jay is Games says towers of the same colour
"hit for 150%"; Grokipedia says "150% ... but only 50% to opposing colors"; the code agrees. The
IGN/PSP-era phrase "elemental damage system" refers to the same 150/50 rule. Treat any tribute
mechanic stronger than 50% as an intentional departure, not a restoration.

---

## 3. Targeting semantics

### 3.1 Modes (confirmed; tower scripts + UI handlers; labels from the SWF static text)

UI labels: **CLOSE**, **HARD**, **WEAK**, plus the display-only **RANDOM** (Spammer) and
**FASTEST** (Blue Rays, Rewinder). Code values: `"closest"`, `"hardest"`, `"weakest"`,
`"random"`, `"fastest"`.

Selection is a single linear scan of `creepArray` (spawn order) over vectoids that are on
screen (`0 < x < 550`, `0 < y < 450`) and within `buffedRange` of the tower centre:

| Mode | Comparison | Notes |
|---|---|---|
| CLOSE | `dist < best` (Euclidean, tower centre to vectoid position) | Default for Green Lasers and Red Refractor |
| HARD | `hp > best` (current HP, not max HP) | Default for Purple Powers and Red Rockets |
| WEAK | `hp < best` (current HP) | -- |
| RANDOM | uniform over all in-range vectoids | Little Red Spammer only; cannot be changed |
| FASTEST | `speed > best` (current speed) | Blue Rays 2 and Rewinder; Blue Rays 1 instead fills 4 slots in array order (see 1.3); cannot be changed |

Tie-break (confirmed from the strict `<` / `>` comparisons and the initial `qualifier == 0`
sentinel): the **first vectoid in creep-array order** wins, which is the earliest spawned,
i.e. the leader of the wave (vectoids are spawned 20 px apart behind the entrance, leader
first). The Hidden Blade observed the same: "In case of a tie, WEAK and HARD seem to pick the
leader of the pack." Because HARD/WEAK compare *current* HP, a HARD tower drifts to the
next-healthiest vectoid as it chews through the leader; a WEAK tower tends to finish off
damaged stragglers. There is no "first / last on path" mode in any build.

Edge case: the `qualifier == 0` sentinel means a vectoid at exactly 0 px or with exactly 0 HP
would be treated as "no best yet" -- harmless in practice.

Changing mode or lock costs nothing and can be done mid-wave; the Hidden Blade walkthrough
toggles modes wave-by-wave as a tactic.

### 3.2 Target locking (confirmed)

**Vector TD (v1)**: no toggle exists (no `targetLock` field, no UI handler). Behaviour is
implicit:

- Green Lasers: keep the current target until it dies or leaves range/screen; then wait 10
  frames and re-select by mode.
- Red Refractor, Red Rockets, Purple Powers: keep the current target across shots until it dies
  or leaves range/screen; if no target is found, retry in 2 frames.
- Spammer, Blue Rays: re-select every shot by construction.

**Vector TDx and Vector TD 2**: `targetLock` (default `true`) on RED REFRACTOR, RED ROCKETS,
PURPLE POWER 1/2/3, with sidebar buttons "TARGET LOCKING ON" / "TARGET LOCKING OFF".

- ON: identical to v1 -- hold the target until it dies or leaves range.
- OFF: `creep = ""` at the start of every firing cycle, so the mode comparison is re-run for
  each shot (CLOSE: nearest right now; HARD: healthiest right now; WEAK: weakest right now).

Green Lasers, Spammer, Blue Rays and Rewinder have no lock toggle in any build. The Hidden
Blade's description ("ON means continue firing on the selected target until it's destroyed or
goes out of range; OFF means select a new target for each shot") matches the code exactly.
Perception Is Truth's advice to run Red Rockets on WEAK with locking OFF is consistent with
this: each rocket goes to whatever is currently weakest.

### 3.3 Range and "on screen" (confirmed)

Range checks use the tower's centre (`_X + 12.5, _Y + 12.5`) and the vectoid's registration
point. Vectoids outside `0..550 x 0..450` (still in the off-screen spawn queue) are ignored by
towers; rockets and purple beams additionally abort if the target goes below 25 px on either
axis. Range and Range Booster are shown in the info panel as `RANGE: <n>m`.

---

## 4. Differences between the builds

| Area | Vector TD (2007-06-04) | Vector TDx (2007-10-18) | Vector TD 2 (2008-01-14) |
|---|---|---|---|
| Waves | 40 | 50 | 50 (Normal); 49 in Lightning |
| Maps | 8 (Switchback, Snaking Path, Round the Twist, Elemental-ish, The Frog, Do the Splits, No Left Turns, Up and Down) | not enumerated here | "six new maps" (archive.org blurb); not enumerated here |
| Modes | 1 | 1 | Normal, Time Attack, Lightning, Sandbox |
| Towers | 11 | 12 (+ Rewinder) | 12 (+ Rewinder) |
| Green Laser 3 dmg | 180 | 200 | 200 |
| Little Red Spammer | 400 dmg, 80 range | 600, 90 | 600, 90 |
| Blue Rays 1 | 1000 dmg, slow to 1/8, only un-slowed targets | 500, slow to 1/6, prefers un-slowed then any | same as TDx |
| Blue Rays 2 | 6000 dmg, speed -0.2 | 4000, speed 0 | 4000, speed -0.5 |
| Grey / bonus-cell damage taken | 100% | 75% | 75% |
| Hard Grey HP | 1.5x | 1x | 1x |
| Bonus cell HP | 6x | 4x | 4x |
| Bonus wave every | 5 | 10 | 5 |
| Target locking toggle | no | yes | yes |
| Starting bank | $250 | $275 | $275 |
| Vectoid types | 5 colours + grey + cell | + Orange Regener (speed 1.5, regenerates maxhp/400 per frame = 10% HP/s) + Orange Spurter (periodic 4.5x speed burst, decays 0.1/frame) | same 5 + grey + cell (no orange) |
| Creep speed cap | recovers +0.01/frame up to max | + `-0.1/frame` when above max | same as TDx |
| Score | +worth per kill, +interest, -2x worth per leak | -- | +100x worth per kill (Sandbox: +level^2 instead), +2x interest %, -100x worth per leak |

TD 2 mode constants (confirmed): Time Attack -- bank 275, base HP 220, worth 8, HP growth
divisor 35, 10 lives, no interest, no bonus waves. Lightning -- all waves Yellow Sprinters at
speed 2, base HP 320, growth divisor 4. Sandbox -- bank $50,000, base HP 50,000, worth 0, 5
lives, no interest, starts with 2 bonus points, auto-release on.

Tower costs did **not** change between builds despite one web summary saying "some of the
towers cost different sums of money" (single-source, contradicted by code).

The exact v1.x patch level of the archived SWF is **unknown**: it is the build Candystand served
until the site closed (2016), lightly patched by the uploader only to remove a tracking
("stinger") call. No version string is present in the scripts. TD 2's filename
(`vectortd2v32Th.swf`) suggests an internal v3.2 but this is not confirmed in-game.

---

## Sources

Primary (decompiled game code -- basis for everything marked confirmed):

- https://archive.org/details/vector_td -- `VectorDR.swf` (Vector TD, Candystand build). Tower
  scripts `DefineSprite_*_tower_*`, main game `DefineSprite_525`, shop rollovers
  `DefineSprite_447`, creep `DefineSprite_39_creep`.
- https://archive.org/details/vector_tdx -- `vectortdxTh.swf` (Vector TDx). Main game
  `DefineSprite_475`.
- https://archive.org/details/vectortd2v32Th -- `vectortd2v32Th.swf` (Vector TD 2). Main game
  `DefineSprite_565`, shop `DefineSprite_465`, creep `DefineSprite_55_creep`.
- Decompiled with JPEXS Free Flash Decompiler 24.0.1 (`ffdec -export script`, `-export text`).
  Decompiled output was left in `/tmp/vtd/out_*` on the research machine and is not committed.

Secondary (web):

- https://thehiddenblade.com/vector-tdx-beyond-level-37 -- TDx: exact definitions of CLOSE /
  HARD / WEAK and lock ON/OFF, tie-break observation, cost/damage/DPS table, per-wave HP table.
- https://jayisgames.com/review/vector-td.php -- review + comments: 150% / 50% colour pairs,
  "close / strong / weak" modes, bonus point from the Hard Grey wave power cell, some costs.
- https://jayisgames.com/review/vector-td-2.php -- TD 2 modes (time attack, lightning,
  puzzle/sandbox $50,000), support towers bought with bonus points.
- https://perceptionistruth.com/2012/02/beating-vector-td-easy-and-normal/ -- strategy;
  "Red Rockets ... target weak creeps first and ... target locking disabled".
- https://walkthrough.freeola.com/game/100562/psp/vector-td.html -- PSP port walkthrough:
  tower and vectoid descriptions, Damage Booster 25%.
- https://grokipedia.com/page/vector_td -- AI-generated summary; 150%/50% rule, wave colour
  pattern, 75% sell, level 10 cap. Used only as corroboration.
- https://en.wikipedia.org/wiki/Vector_TD -- release/platform facts, "upgradeable to level 10".
- https://candystand.fandom.com/wiki/Vector_TD -- tower list names (via MediaWiki API).
- http://candystandblog.blogspot.com/2007/06/vector-td-faq.html -- launch FAQ; no mechanics.
- https://www.escapegames24.com/2007/06/vector-td-tower-defence.html and
  https://www.escapegames24.com/2008/03/vector-td-2.html -- reader comments; no hard numbers.
- Wikipedia / Grokipedia / GameFAQs PSP page: "eleven tower types, seven vectoid types".

Sources tried and unusable: Giant Bomb guide (403 to fetch, and the HTML had no guide body),
vectoidtd3d.miraheze.org (bot challenge page), toptowerdefensegames.com (DNS dead),
theubergamer.wordpress.com and free2wingames.com (no numbers).

---

## Gaps

- Exact patch level (v1.0 vs v1.x) of the archived Vector TD SWF; no version string in the code.
- Whether the Red Rockets `rocket` clip is drawn as two missiles (the description says "two",
  the code fires one projectile per cycle).
- TDx and TD 2 map names and path layouts (not extracted; they live in map sprites, not scripts).
- PSP / iOS / PS3 port stats -- assumed identical to the Flash builds but not verified.
- The unused `power` / `tower_power` system (`powerBase = 5000`) present in all three builds:
  no shop entry or gameplay effect was found; ignored.
- Kongregate / Newgrounds / Armor Games pages: the game was Candystand-exclusive; no such pages
  with mechanics were found.
- No independent web source for the 75%-vs-grey rule or the blue-tower bug; both are
  code-only (single build each confirmed by reading, present in all builds checked).

---

## Corrections (2026-09-12, after re-reading the v1.2 build `ftd.swf`)

The "Vector TD (v1)" statements above about target locking were taken from `VectorDR.swf`, which
is **v1.0**. They do not hold for **v1.2** (`ftd.swf`, `version = "v1.2"`), the build the tribute
models. Full evidence in `vector-td-v12-verification.md`.

- **Summary bullet "Target Locking: v1 has no toggle" and section 3.2** -- wrong for v1.2.
  v1.2 already has `targetLocking` / `targetLock` (default `true`) on RED REFRACTOR, RED ROCKETS
  and PURPLE POWER 1/2/3, the sidebar `button_acquire` sprite (452) with "TARGET LOCKING ON/OFF",
  and the `if(targetLock == false) creep = "";` line in each of those five tower scripts. Only
  v1.0 lacks the toggle. The ON/OFF semantics described under "TDx and TD 2" are exactly what
  v1.2 does.
- **Section 4 table, row "Target locking toggle"** -- should read: v1.0 no, **v1.2 yes**, TDx yes,
  TD 2 yes. (The whole "Vector TD (2007-06-04)" column describes v1.0; the v1.2 column would
  match TDx for Green Laser 3 200 dmg, Spammer 600/90, Blue Rays 1 500 "prefers un-slowed then
  any", Blue Rays 2 4000, grey/cell 75%, cell HP 4x, bank $275, bonus every 5, 100x/2x scoring.)
- **Section 1.4 icon mapping (marked "inferred")** -- wrong. From the sidebar sprite (457) placement
  matrices: row 4 is DAMAGE BOOSTER (red flaming rocket, `tower_buff1`), RANGE BOOSTER (green
  spiked star, `tower_buff2`), INTEREST INCREASE (gold $, char 411), PANIC! (blue atom, char 413).
  The "atom" is Panic!, not Red Refractor; "spiked green" is Range Booster, not Green Laser 3;
  the "rocket" is Damage Booster, not Red Rockets. Red Refractor is the r1c2 red star-burst,
  Little Red Spammer the r2c2 nine dots, Red Rockets the r3c2 square-in-square; r3c4 is an empty
  placeholder square. Sprites exported to `sprites-v1.2/`.
- **Section 3.1, Blue Rays UI**: for Blue Rays 1/2 the CLOSE/HARD/WEAK row is *replaced* by a
  single "FASTEST" label (frame 3 of `button_firemode`), and for the Spammer by "RANDOM" (frame 2);
  the lock button shows a greyed "TARGET LOCKING ON" for Green Lasers, Spammer and Blue Rays.
- **Gaps, first bullet**: the v1.2 build *does* carry a version string (`version = "v1.2"` in
  `frame_1/DoAction_2.as`); it is the v1.0 archive build that has none.

---

## Addendum (2026-09-12): can a Booster be sold? No -- confirmed

Question raised by the M1-14 ticket. Read from the v1.2 build (`/tmp/vtd/out_ftd/scripts/`,
same decompile as the Corrections above).

- `showInfo(n)` in `DefineSprite_536/frame_1/DoAction.as` (lines 1404-1536) branches on
  `n.Type == "tower"`. For a Damage Booster (`Type = "buffD"`) or Range Booster
  (`Type = "buffR"`) it takes the `else` branch, which sets `button_upgrade`, `button_firemode`,
  `button_sell` and `button_acquire` all `_visible = false` and shows only `n.Description`.
  It also hides the range radar (`if(n.Type != "tower") radar._visible = false`).
- `sell(n)` (lines 1567-1572: `bank += int(n.cost / 100 * 75); removeTower(n); blankInfo();`)
  is called only from `button_sell`, so it is unreachable for a Booster. Boosters also have no
  `cost` field to refund and no `level`, so they cannot be upgraded either.

Consequence for the tribute: once placed, a Booster is permanent. Its Cell stays occupied for
the rest of the Run, and the Bonus Point is never refunded. The sim's `placeBooster` is
therefore irreversible and there is no `sellBooster` Command.
