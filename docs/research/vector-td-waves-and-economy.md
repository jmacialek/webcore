# Vector TD (2007) and Vector TD 2 — waves, economy, score, lives

Research notes for the Vector 3D tribute. Compiled 2026-09-12.

## Summary

The single most useful discovery is that the games' rules are not hidden in a
server: every number lives in ActionScript 2 inside the SWF. Four builds were
downloaded and decompiled with JPEXS FFDec 24.0.1 (all data marked
**confirmed** below comes from that code, cross-checked against player-quoted
numbers where they exist):

| Build | Where it came from | What it is |
|---|---|---|
| `VectorDR.swf` | archive.org `vector_td` item | **Vector TD v1.0**, the 4 June 2007 launch build: 40 levels, 8 maps, no difficulty tiers |
| `vectortd.swf` | flashtowerdefence.com CDN | **Vector TD v1.2** (`version = "v1.2"` in frame 1): 50 levels, 8 maps in Easy/Normal/Hard tiers. This is the build people remember and the one the tribute should model. |
| `vectortd2v32Th.swf` | archive.org `vectortd2v32Th` item | **Vector TD 2** (Jan 2008): 6 maps, 4 modes |
| `vectortdxTh.swf` | archive.org `vector_tdx` item | **Vector TDx** (Oct 2007): 50 levels, 7 vectoid types, bonus every 10 |

Headline facts (v1.2 unless stated):

- 50 waves, 28 vectoids per wave (14 on each of two spawn lines, every map has two lines). Wave type sequence is a fixed array; every 5th wave is "Hard Grey + Bonus"; wave 50 is a mixed "All types" wave.
- HP is geometric: `baseHP += int(baseHP / k)` after each wave, with `k` itself creeping up by 0.02–0.03 per wave. Easy starts 550 HP, Normal 600, Hard 625.
- Bounty is linear: Easy `$level+4`, Normal `$level+3`, Hard `$level+2`.
- Bank starts $275 (Easy/Normal) or $250 (Hard); 20 lives; interest 3%, +3% per "Interest Increase" bonus purchase, no cap (33% nominal max).
- Interest is paid **at the moment a wave is sent** (manual or Auto), on the whole current bank, and not on wave 1. Selling refunds 75% of total spend on that tower.
- Score = 100 x bounty per kill, + 2 x the interest dollars at each wave send, − 100 x bounty per leak, floored at 0. v1.0 used 1x/1x/−2x instead.
- One life per leak, regardless of type; a leaked vectoid re-enters the path and can leak again. Game over the instant lives hit 0; finishing wave 50 ends the game with "YOU COMPLETED ALL 50 LEVELS" — there is no endless mode.

Confidence key: **confirmed** = in the decompiled game code (and, where noted, also in an independent player source); **single-source** = one community source, not in code; **unknown** = no source found.

---

## 1. Wave table

### 1.1 Wave structure (v1.2) — confirmed

```
levels = [2,1,2,3,7,4,2,5,2,7,2,3,2,4,7,5,2,1,2,7,2,4,2,5,7,1,2,3,2,7,
          4,2,5,2,7,5,2,1,2,7,1,2,3,2,7,2,1,2,4,8]
```

Type codes (from `creepName()` and `spawn()`):

| Code | Name shown in Current/Next panel | Speed | Damage taken | Notes |
|---|---|---|---|---|
| 1 | Red Shredder | 1 | 150% from red towers, 50% from green | |
| 2 | Blue Spinner | 1 | 150% from blue towers, 50% from purple | 40% of all waves |
| 3 | Green Flyer | 1 | 150% from green towers, 50% from red | |
| 4 | Yellow Sprinter | **2** (double) | 100% from every tower (no colour affinity in code) | the only fast type; countered by Blue Rays slow |
| 5 | Big Purple Box | 1 | 150% from purple towers, 50% from blue | |
| 6 | (bonus cell, no name) | 1 | 75% from every tower | 1 per bonus wave, **4x HP**, awards 1 bonus point on kill |
| 7 | "Hard Grey **+ Bonus**" | 1 | **75% from every tower** | same HP as the wave's other vectoids in v1.2 |
| 8 | "All types" (HUD shows "???" as the *next* preview at wave 49) | mixed | mixed | wave 50 only |

- Per-wave count: `v = 1; while (v < 15)` per spawn path, so **14 per path**. All eight v1.2 maps define two paths (`paths = [[...],[...]]`), so **28 vectoids per wave** (confirmed; Grokipedia independently states "each consisting of 28 vectoids").
- Bonus wave rule (`waveB`): on every level where `level % bonusEvery == 0` (`bonusEvery = 5`), the **14th creep on the last path is replaced by a type-6 bonus cell** with `hp = baseHP * 4`. That is what "+ Bonus" in the Current & Next panel means: this wave carries one power cell; kill it and `ups++` (a bonus point). If it leaks you get nothing — `ups` only increments in `kill()`.
- Hard Grey (type 7) cadence: waves 5, 10, 15, 20, 25, 30, 35, 40, 45 (nine of them), each also carrying the bonus cell. What "hard" means in v1.2: **every tower's damage is multiplied by 0.75 against types 6 and 7** (nine `d / 100 * 75` branches in `fire()`, one per tower kind); their HP is not raised. In v1.0 it was the opposite: grey had `1.5 x baseHP` and no damage reduction (see 5.1).
- Wave 50 ("All types", code 8): `spawn()` assigns type `int(cc/5)+1` by spawn order (`cc` counts creeps in the wave), mapping 6 to 7. With 28 creeps that yields 4 Red, 5 Blue, 5 Green, 5 Yellow, 5 Purple, 3 Hard Grey, and — because 50 is a multiple of 5 — the last creep is a bonus cell. The panel shows "???" as the wave-49 preview and "All types" during wave 50.
- Colour pattern between grey waves is Blue/X alternating (Blue, Red, Blue, Green, [Grey], Yellow, Blue, Purple, Blue, [Grey], ...), i.e. Grokipedia's "8-long Blue, Red, Blue, Green, Blue, Yellow, Blue, Purple with every 5th replaced by Grey" description is consistent with the array.
- There are no "boss" waves other than this: no single-creep waves, no multi-life creeps. Yellow's speed and Grey's damage resistance are the only per-type stat differences; all creeps of a wave share `baseHP`.

### 1.2 HP progression and bounty (v1.2) — confirmed (formula from code, table computed from it)

Setup by map tier (`Level` is the map index 1–8):

| Tier | Maps | Start bank | Start HP | HP divisor `k` | `k` growth per wave | Bounty at wave n |
|---|---|---|---|---|---|---|
| Easy (maps 1–2) | Switchback, Snaking Path | $275 | 550 | 5.0 | +0.03 | $n + 4 |
| Normal (maps 3–5) | Round the Twist, Up and Down, Elemental-ish | $275 | 600 | 4.5 | +0.03 | $n + 3 |
| Hard (maps 6–8) | The Frog, Do the Splits, No Left Turns | $250 | 625 | 4.2 | +0.02 | $n + 2 |

Per-wave update (end of `wave()`): `baseHP += int(baseHP / k); baseWorth += 1; k += step`. Bonus cell HP = 4 x that wave's HP. The map-to-tier grouping (2/3/3) matches the JayIsGames commenter "vozome" (12 June 2007): "now the maps are grouped 'easy/normal/hard' and each map has 50 instead of formerly 40 levels" — confirmed.

Computed table (integer maths reproduced exactly as the AS2 does it; the same simulation reproduces the TDx table published by a player to the digit, see 5.3, which validates the method):

| Lv | Type | Easy HP | Normal HP | Hard HP | Bounty E / N / H |
|---|---|---|---|---|---|
| 1 | Blue Spinner | 550 | 600 | 625 | $5 / $4 / $3 |
| 2 | Red Shredder | 660 | 733 | 773 | $6 / $5 / $4 |
| 3 | Blue Spinner | 791 | 894 | 956 | $7 / $6 / $5 |
| 4 | Green Flyer | 947 | 1,090 | 1,181 | $8 / $7 / $6 |
| 5 | Hard Grey + Bonus | 1,133 | 1,327 | 1,458 | $9 / $8 / $7 |
| 6 | Yellow Sprinter | 1,354 | 1,614 | 1,798 | $10 / $9 / $8 |
| 7 | Blue Spinner | 1,616 | 1,961 | 2,216 | $11 / $10 / $9 |
| 8 | Big Purple Box | 1,927 | 2,380 | 2,728 | $12 / $11 / $10 |
| 9 | Blue Spinner | 2,296 | 2,885 | 3,356 | $13 / $12 / $11 |
| 10 | Hard Grey + Bonus | 2,734 | 3,493 | 4,125 | $14 / $13 / $12 |
| 11 | Blue Spinner | 3,252 | 4,225 | 5,066 | $15 / $14 / $13 |
| 12 | Green Flyer | 3,865 | 5,105 | 6,217 | $16 / $15 / $14 |
| 13 | Blue Spinner | 4,590 | 6,161 | 7,623 | $17 / $16 / $15 |
| 14 | Yellow Sprinter | 5,446 | 7,428 | 9,339 | $18 / $17 / $16 |
| 15 | Hard Grey + Bonus | 6,456 | 8,947 | 11,432 | $19 / $18 / $17 |
| 16 | Big Purple Box | 7,647 | 10,765 | 13,983 | $20 / $19 / $18 |
| 17 | Blue Spinner | 9,050 | 12,939 | 17,090 | $21 / $20 / $19 |
| 18 | Red Shredder | 10,701 | 15,537 | 20,870 | $22 / $21 / $20 |
| 19 | Blue Spinner | 12,643 | 18,638 | 25,466 | $23 / $22 / $21 |
| 20 | Hard Grey + Bonus | 14,925 | 22,336 | 31,050 | $24 / $23 / $22 |
| 21 | Blue Spinner | 17,604 | 26,741 | 37,829 | $25 / $24 / $23 |
| 22 | Yellow Sprinter | 20,747 | 31,984 | 46,052 | $26 / $25 / $24 |
| 23 | Blue Spinner | 24,432 | 38,218 | 56,019 | $27 / $26 / $25 |
| 24 | Big Purple Box | 28,748 | 45,624 | 68,092 | $28 / $27 / $26 |
| 25 | Hard Grey + Bonus | 33,800 | 54,414 | 82,704 | $29 / $28 / $27 |
| 26 | Red Shredder | 39,709 | 64,838 | 100,375 | $30 / $29 / $28 |
| 27 | Blue Spinner | 46,614 | 77,188 | 121,731 | $31 / $30 / $29 |
| 28 | Green Flyer | 54,678 | 91,806 | 147,521 | $32 / $31 / $30 |
| 29 | Blue Spinner | 64,089 | 109,095 | 178,643 | $33 / $32 / $31 |
| 30 | Hard Grey + Bonus | 75,063 | 129,524 | 216,173 | $34 / $33 / $32 |
| 31 | Yellow Sprinter | 87,850 | 153,643 | 261,397 | $35 / $34 / $33 |
| 32 | Blue Spinner | 102,739 | 182,095 | 315,854 | $36 / $35 / $34 |
| 33 | Big Purple Box | 120,064 | 215,629 | 381,383 | $37 / $36 / $35 |
| 34 | Blue Spinner | 140,208 | 255,121 | 460,181 | $38 / $37 / $36 |
| 35 | Hard Grey + Bonus | 163,615 | 301,591 | 554,868 | $39 / $38 / $37 |
| 36 | Big Purple Box | 190,793 | 356,227 | 668,570 | $40 / $39 / $38 |
| 37 | Blue Spinner | 222,329 | 420,412 | 805,012 | $41 / $40 / $39 |
| 38 | Red Shredder | 258,896 | 495,754 | 968,632 | $42 / $41 / $40 |
| 39 | Blue Spinner | 301,268 | 584,123 | 1,164,711 | $43 / $42 / $41 |
| 40 | Hard Grey + Bonus | 350,334 | 687,690 | 1,399,531 | $44 / $43 / $42 |
| 41 | Red Shredder | 407,114 | 808,975 | 1,680,561 | $45 / $44 / $43 |
| 42 | Blue Spinner | 472,777 | 950,900 | 2,016,673 | $46 / $45 / $44 |
| 43 | Green Flyer | 548,664 | 1,116,851 | 2,418,400 | $47 / $46 / $45 |
| 44 | Blue Spinner | 636,310 | 1,310,748 | 2,898,241 | $48 / $47 / $46 |
| 45 | Hard Grey + Bonus | 737,472 | 1,537,129 | 3,471,015 | $49 / $48 / $47 |
| 46 | Blue Spinner | 854,160 | 1,801,240 | 4,154,285 | $50 / $49 / $48 |
| 47 | Red Shredder | 988,673 | 2,109,144 | 4,968,850 | $51 / $50 / $49 |
| 48 | Blue Spinner | 1,143,637 | 2,467,841 | 5,939,328 | $52 / $51 / $50 |
| 49 | Yellow Sprinter | 1,322,051 | 2,885,411 | 7,094,839 | $53 / $52 / $51 |
| 50 | All types (mixed) | 1,527,338 | 3,371,170 | 8,469,807 | $54 / $53 / $52 |

Bonus cell on waves 5,10,...,50 has 4x the listed HP (e.g. Normal wave 45: 6,148,516).

HUD display quirk (confirmed): the "Next" HP preview is `baseHP + int(baseHP/k)` computed *before* `k` is incremented, so it can differ from the actual next-wave HP by a few points. The Current/Next panel shows `"<name><br><hp> hp    $<bounty>"`.

### 1.3 Vector TD 2 (Normal mode) wave table — confirmed

Identical `levels[]` array to v1.2 and identical Normal-tier economy (bank 275, HP 600, k 4.5 +0.03 for maps 1–5 / +0.02 for map 6, bounty $n+3, 28 per wave, bonus every 5). The v1.2 "Normal HP" column above therefore *is* the VTD2 Normal table for maps 1–5; map 6 (Ladder) uses the +0.02 growth so from wave 3 onward its HP is very slightly higher (e.g. wave 50: 4,803,980 instead of 3,371,170). Other VTD2 modes are in section 5.2.

---

## 2. Economy

| Item | v1.2 value | Confidence | Notes |
|---|---|---|---|
| Starting bank | $275 Easy/Normal, $250 Hard | **confirmed** (code; perceptionistruth and TDx commenters quote $275; v1.0 code and JayIsGames review quote $250) | JayIsGames' "$250" describes v1.0 |
| Starting lives | 20 | **confirmed** (code; JayIsGames, Grokipedia, HiddenBlade) | |
| Starting interest | 3% | **confirmed** (code; HUD text `interest + "%"`) | |
| Interest step per "Interest Increase" purchase | +3 percentage points | **confirmed** (code `interest += 3`; item text "Increases the interest rate by 3%") | |
| Interest cap | none in code; 10 bonus points x 3% = **33% nominal**, but the 10th cell is on wave 50 so **30% is the highest rate that ever pays out** | **confirmed** (code) + statto on JayIsGames ("at level 45 maximum interest could yield 30%") | |
| When interest is paid | inside `wave()`, i.e. **the instant a wave is sent** (manual button or Auto), before the new creeps spawn; **not on wave 1** (`if (level > 1)`) | **confirmed** (code; item text "Interest is earned each time you send a wave"; HiddenBlade: "you earn interest on what's in the bank at the time you release the vectoids ... You earn the same interest with Auto") | v1.0 paid it on wave 1 as well; a JayIsGames comment from 18 Jun 2007 ("send the very first wave before placing your first tower ... that $8" = 3% of $275) implies the first 50-level build (v1.1?) also paid on wave 1 — **single-source** |
| On what balance | `int(bank / 100 * interest)` on the whole current bank, simple (not compounding within a wave), truncated | **confirmed** | so selling a tower *before* pressing send earns interest on the refund — Dano/Si on JayIsGames, HiddenBlade |
| Does interest change per level | no; only via bonus purchases | **confirmed** | |
| Sell refund | 75% of `n.cost`, where `cost` = purchase price + all upgrade payments | **confirmed** (code; Grokipedia 75%) | Dano's JayIsGames arithmetic ("10000 ... you get back 7500") agrees |
| Upgrade | each level costs `baseCost/2`, adds `baseDamage/2.2` damage and `baseRange/20` range, max level 10 | **confirmed** | |
| Bounty per kill | `$level + 4 / +3 / +2` by tier (see 1.2) | **confirmed** (code; Grokipedia's "$4 plus the current wave number" is the *Easy* tier stated loosely; Stevie-O on JayIsGames: "It used to be $(3 + Level) per creep", v1.0 was actually $level+2) | |
| "Interest Increase" ("dollar" item) | costs 1 bonus point, permanently `interest += 3`; item text: "This is not a tower so you just click to pick." | **confirmed** | it is not placed on the map and has no other effect |
| Other bonus items | Damage Booster (placed; +25% damage to towers in range), Range Booster (placed; +25% range), Panic! (+5 lives, click to pick). Each costs 1 bonus point. | **confirmed** | PSP port guide says Panic gives 4 lives — **single-source**, PSP only |
| How bonus points are earned | kill the type-6 bonus cell (last creep, last spawn line, every 5th wave); `ups++` | **confirmed** | max 10 per game, 9 usable before the end |
| "Send the Vectoids" (button code name `Release`) | calls `wave()` — increments level, pays interest, spawns 28 creeps. **Enabled only while 10 or fewer vectoids remain alive** (`creepArray.length <= 10`) and before wave 50. No cash or score bonus for sending early; the only "reward" is that the interest tick happens sooner. | **confirmed** | JayIsGames/Grokipedia strategy chatter about early-send "reducing score" is because your bank is smaller when the tick lands, not a penalty |
| "Auto" checkbox | toggles `autoLevel`; when on, `kill()` calls `wave()` the moment the last creep dies (so the next wave is sent with zero gap). Ticking it while the field is already empty sends immediately. Interest is identical to manual sending. | **confirmed** (code; HiddenBlade) | |
| "Power" meter | `powerBase = 5000`, `doPower()` updates `_ui.power` have/using/need bars from towers of Type "power" | **confirmed present in code**; whether it was visible/used in shipped v1.2 is **unknown** (no sidebar entry for a power tower was found) | vestigial |

Tower price list (v1.2, base cost / damage / range) for economy modelling — confirmed: Green Laser 1 $100/22/70, Green Laser 2 $400/45/70, Green Laser 3 $2000/200/70, Red Refractor $200/110/80, Little Red Spammer $800/600/90, Red Rockets $2500/30000/150, Purple Power 1 $300/2650/100, Purple Power 2 $900/8500/100, Purple Power 3 $2800/22000/100, Blue Rays 1 $300/500/70, Blue Rays 2 $500/4000/80. (v1.0 differed: Green 3 180 dmg, Spammer 400 dmg/80 range, Blue Rays 1 1000 dmg, Blue Rays 2 6000 dmg.) VTD2 adds REWINDER $1300/0 dmg/65 range.

---

## 3. Score formula

v1.2 (and VTD2 Normal/Time Attack/Lightning, and TDx) — **confirmed**:

```
on kill:        score += int(worth) * 100          // worth = that wave's bounty
on wave send:   score += int(bank / 100 * (interest * 2))   // computed BEFORE bank += interest; not on wave 1
on leak:        score -= worth * 100;  if (score < 0) score = 0
```

- Score therefore = 100 x (total bounty collected − total bounty leaked) + 2 x (total interest dollars ever paid). HiddenBlade (TDx, 2014): "whenever your bank account earns interest, you get double that amount added to your score" — independent confirmation for the TDx build, same code in v1.2.
- There is **no** time bonus, no per-wave completion bonus, no lives-remaining bonus, no end-of-game multiplier. Distance travelled is irrelevant (a commenter asked; the code says no).
- Because interest dollars count double and late bounties are huge, the late game dominates: the escapegames24 commenter "Abenforth" reports $2.2M bank and 8.93M points at the end; JayIsGames VTD2 commenters report 4M–10M for a clean 50-wave run.
- "Bonus" wording: no HUD text field named bonus exists in the code. HUD fields are `lvlText` ("n/50"), `interestText` ("3%"), `bankText` ("$275"). The word "Bonus" appears in-game as the yellow "+ Bonus" suffix on Hard Grey waves in the Current/Next panel, and as the sidebar bonus-item icons that pulse (`pulserA`) while `ups > 0`. If the original top bar showed a "Bonus" counter it is not in this build — **unknown**.
- After wave 50: when `creepArray` is empty and `level == 50`, `gameOver()` runs, pauses the game, and shows "CONGRATULATIONS! YOU COMPLETED ALL 50 LEVELS AND SCORED: <score>". The score is then posted to the host's arcade (IPB/Candystand score-submit code present). **No endless mode** — confirmed.

v1.0 scoring (for the record) — confirmed: `score += worth` per kill (1x), `score += int(bank/100*interest)` per wave send *after* the bank had been updated (1x, on the post-interest bank), `score -= worth * 2` per leak. The JayIsGames commenters "vozome" (13 Jun 2007: "$100,000 ... 12% interest, you get $12,000 dollars and a 12,000 point boost") and "statto" (28 Jul 2007: "a point for every dollar in interest") describe this 1x rule, so the 50-level build they played (June–July 2007) still had v1.0 scoring; the x100 / x2 rule arrived at some later 1.x revision (exact version **unknown**; it is in v1.2).

---

## 4. Lives and leaks

| Item | Value | Confidence |
|---|---|---|
| Starting lives | 20 (all VTD1 builds; VTD2 Normal and Lightning) | **confirmed** |
| Cost of a leak | exactly 1 life for every type, including Hard Grey and the bonus cell | **confirmed** (creep code `g.lives--`; Grokipedia "Each escaped enemy deducts one life, regardless of type") |
| Money on leak | bank untouched; score −100 x bounty (v1.2) | **confirmed** |
| What happens to the leaker | it is teleported back to the path start (`pathPoint = 1; _X = startTarg._x ...`) and keeps walking, so **one vectoid can cost several lives** if never killed | **confirmed** (code; HiddenBlade: "Whenever an enemy goes off the bottom of the map it wraps around to the top and you lose a life") |
| Game over | immediately when `lives < 1` (mid-wave), screen "BAD LUCK, YOU RAN OUT OF LIVES. YOUR SCORE WAS:" | **confirmed** |
| Extra lives | "Panic!" bonus item: +5 (v1.0, v1.2, VTD2). Low-lives warning pulses at `lives <= 5`. | **confirmed** |
| Win | clear wave 50 with lives > 0 | **confirmed** |

---

## 5. Version differences

### 5.1 Vector TD v1.0 (4 Jun 2007, archive.org build) vs v1.2 — confirmed from both code dumps

| | v1.0 | v1.2 |
|---|---|---|
| Levels | 40 (`levels[]` has 40 entries, last = 8 "All types"; HUD "n/40") | 50 |
| Maps / tiers | same 8 maps; maps 1–4 vs 5–8 | same 8 maps; Easy 1–2 / Normal 3–5 / Hard 6–8 |
| Start bank | $250 | $275 / $275 / $250 |
| Start HP | 550 (maps 1–4), 650 (maps 5–8) | 550 / 600 / 625 |
| HP growth | `+= int(baseHP/6)` (maps 1–4) or `/5` (5–8), fixed divisor | `/5`, `/4.5`, `/4.2` with divisor rising 0.03/0.03/0.02 per wave |
| Bounty | $level + 2 everywhere | $level + 4 / +3 / +2 |
| Hard Grey | HP x 1.5, normal damage | normal HP, takes 75% damage |
| Bonus cell | HP x 6 (1.5 x 4) | HP x 4, takes 75% damage |
| Interest on wave 1 | yes | no |
| Score | 1x bounty, 1x interest (post-update bank), −2x bounty per leak | 100x bounty, 2x interest (pre-update bank), −100x per leak |
| Everything else (20 lives, 3% +3%, 75% sell, 14 per line, bonus every 5, Auto, send when ≤10 remain, Panic +5) | same | same |

The 40-to-50 change and the tiering happened within the first week (vozome, JayIsGames, 12 Jun 2007). Intermediate builds v1.1 / v1.3 were not found — **unknown** whether they exist and what they changed beyond the two comment-documented steps ($3-base bounty to $4-base; 1x to 100x scoring).

### 5.2 Vector TD 2 (14 Jan 2008) vs Vector TD v1.2 — confirmed from code

- Maps: 6 new ones — Pathways, Bottleneck, 2 In 1 Out, Slim Pickings, Void, Ladder. Maps 1–5 use the +0.03 HP-divisor growth, map 6 uses +0.02 (HUD tier labels not found in code).
- Modes (`Mode` 1–4):

| Mode | Bank | Start HP | HP divisor | Bounty base | Lives | Interest | Bonus cell every | Waves |
|---|---|---|---|---|---|---|---|---|
| Normal | $275 | 600 | 4.5 (+0.03/0.02) | $4 | 20 | 3% | 5 | 50, same array as v1.2 |
| Time Attack | $275 | 220 | 35 (+0.1 per spawn) | $8 | 10 | none (HUD "N/A") | never (`bonusEvery = 500`) | continuous: one creep per path every 41 frames; type advances Red-Blue-Green-Yellow-Purple-Grey every 10 spawns; bounty +1 per full cycle; no win condition |
| Lightning | $275 | 320 | 4 (+0.03/0.02) | $4 | 20 | 3% | 5 | 49-entry array of all Yellow Sprinters, every creep speed 2 (HUD shows n/49) |
| Puzzle/Sandbox | $50,000 | 50,000 | 10 | $0 | 5 | none | none (grey waves are plain "Hard Grey", no "+ Bonus") | 50; starts with 2 bonus points and Auto forced on; score = `level^2` per kill |

- Scoring, interest timing, sell refund, upgrade maths, leak handling, Panic (+5 lives) and Interest Increase (+3%) are byte-for-byte the same as v1.2. The JayIsGames VTD2 review's claim that the panic booster "gives you five extra lives instead of just one" is contradicted by the v1.2 code (already +5) — treat the "one" as an error about v1.x.
- New tower: REWINDER ($1300, range 65, 0 damage; pushes vectoids backwards — mechanic from the sprite name, effect details **unknown** beyond `speed = -0.2` style code seen in the shared engine).
- JayIsGames review: "some towers cost different sums of money" — the base tower price list in the VTD2 dump is identical to v1.2, so this is **not confirmed** for the Flash build.

### 5.3 Vector TDx (18 Oct 2007) — confirmed from code, cross-checked with HiddenBlade

Bank $275, HP 850 then `+= int(baseHP/100 * p)` with `p` starting 9% and rising 0.8 pp per wave, bounty $level+2, 20 lives, 3% interest, **bonus cell only every 10th wave** (`bonusEvery = 10`), 14 per line except wave 50 (29 per line), 7 creep types (adds 9 Orange Regener at speed 1.5 and 10 Orange Spurter). Levels array: `[2,3,1,4,5,3,1,9,4,7,1,3,2,4,5,10,1,9,4,7,2,3,1,4,5,3,9,1,10,7,1,3,9,4,5,3,9,1,10,7,2,3,10,4,9,2,9,10,9,10]`. Same 100x/2x/−100x scoring. The player "stabguy" (HiddenBlade, 2014) published an observed HP/score/bounty table for all 50 TDx waves; the simulation of the decompiled formula matches his table exactly for waves 1–41 (e.g. 850, 926, 1016, ..., 5,015,109), which is what validates the computed v1.2 table in 1.2. (His wave-42 and wave-50 figures, 7,010,303 and 200,177,246, differ from the formula's 7,071,303 and 135,072,366 — likely transcription/observation differences on his side; flagged, not resolved.)

### 5.4 PSP / PS3 / iPhone ports (2010) — single-source only

PlayStation Blog: 8 maps (2 Beginner, 3 Normal, 3 Extreme), 50 waves, seven vectoid types, eleven towers, towers upgrade to level 10, "Yellow Energy Cell" every few waves buys one of three boosts, interest paid "on the money you have banked at the end of each level". Freeola PSP walkthrough: Panic gives **4** extra lives (vs 5 in Flash). No port code was examined.

---

## Sources

| # | URL | Contributed |
|---|---|---|
| S1 | https://archive.org/details/vector_td (file `VectorDR.swf`, uploaded 2022 by Computerdude77, "stinger call removed", original in `original.zip`) | Vector TD **v1.0** code: 40 levels, bank 250, bounty $n+2, grey 1.5x HP, 1x scoring, 8 map names, all tower/bonus texts |
| S2 | https://www.flashtowerdefence.com/flash/6/Vector_TD.html embedding `//cdn2.flashtowerdefence.com/flashtowerdefence-cdn/swf/vectortd.swf` | Vector TD **v1.2** code (frame-1 `version = "v1.2"`): everything in sections 1–4 |
| S3 | https://archive.org/details/vectortd2v32Th (`vectortd2v32Th.swf`) | Vector TD 2 code: modes, maps, Rewinder, sandbox scoring |
| S4 | https://archive.org/details/vector_tdx (`vectortdxTh.swf`) | Vector TDx code: levels array, bonus every 10, orange types |
| S5 | https://jayisgames.com/review/vector-td.php (review + comments) | $250 start / 20 lives (v1.0), 40-to-50 level change and easy/normal/hard tiering (vozome 12 Jun 2007), $3-to-$4 bounty change (Stevie-O), 1x interest scoring (vozome, statto), 33%/30% interest max (statto), interest-timing and sell-before-send tactics (Si, Dano), wave-1 $8 interest (AaronzDad) |
| S6 | https://jayisgames.com/review/vector-td-2.php | VTD2 mode list, $50,000 sandbox, panic "five lives" claim, player final scores 4M–10M |
| S7 | https://thehiddenblade.com/vector-tdx-beyond-level-37 (stabguy, 2014) | TDx 50-wave HP/score/bounty table, "double interest to score", Auto vs manual interest equivalence, leak wraps to start, $275 start, tower DPS table |
| S8 | https://perceptionistruth.com/2012/02/beating-vector-td-easy-and-normal/ | $275 start, 27% interest by wave 44, wave-45 bonus use |
| S9 | https://grokipedia.com/page/vector_td (cached copy) | $4 + wave bounty, 75% sell, 28 per wave, 20 lives, one life per leak, colour pattern, interest at start of each wave |
| S10 | https://walkthrough.freeola.com/game/100562/psp/vector-td.html (pb) | PSP: vectoid descriptions, Panic = 4 lives, Hard Grey "contain a bonus in the ring they carry" |
| S11 | https://en.wikipedia.org/wiki/Vector_TD | release dates, ports, three difficulty levels, level-10 upgrades |
| S12 | https://www.escapegames24.com/2007/06/vector-td-tower-defence.html (comments) | Abenforth: $2.2M bank / 8.93M points at end; level 34/45 difficulty spikes |
| S13 | https://blog.playstation.com/archive/2010/01/21/vector-td-minis-available-today | PSP: 8 maps in 3 tiers, 50 waves, 7 vectoids, energy-cell boosts |
| S14 | https://www.kongregate.com/games/braichuski/vector-td | 2012 unauthorised re-upload, non-functional; no data |
| — | https://rpgcodex.net/forums/threads/vector-tower-defense.32418/, https://forums.totalwar.org/vb/printthread.php?t=98766, https://flasharch.com/..., https://flashmuseum.net/game/vector-td-4ly/, Wayback candystand.com | fetched but blocked (403 / no fetch); flashmuseum's S3 SWF link returned access-denied |

Decompile method: `java -jar ffdec.jar -export script <out> <swf>` (JPEXS 24.0.1, OpenJDK 25). Game logic is AS2 in `DefineSprite_525` (v1.0), `DefineSprite_536` (v1.2), `DefineSprite_565` (VTD2), `DefineSprite_475` (TDx); creep leak logic in `DefineSprite_39_creep` / `_55_creep` / `_47_creep`; bonus-item texts in the sidebar sprite `PlaceObject2_405_61` (Interest) and `_407_71` (Panic). Working copies are in `/tmp/vtd/` (not committed).

## Gaps

1. **Exact map layouts / path coordinates** were not extracted (present in the map sprite frames of S2 — a follow-up if the tribute wants faithful maps).
2. **Which v1.x revision** introduced the 100x/2x scoring and dropped wave-1 interest is unknown; only v1.0 and v1.2 binaries were found. No v1.1 or v1.3 build located.
3. **A "Bonus" counter in the top bar**: no such text field exists in v1.0/v1.2 code; if it existed it was part of the Candystand page chrome, not the SWF. Unknown.
4. **Power meter** (`powerBase 5000`, "power" tower type): present in code in every build but no sidebar entry; unknown whether it was ever visible in the shipped game.
5. **REWINDER** (VTD2) exact behaviour not traced.
6. **PSP/PS3/iPhone port numbers** (HP curve, Panic = 4 lives, tier names Beginner/Normal/Extreme) are single-source from marketing/fan text; no port binary examined.
7. **TDx waves 42 and 50** HP: player-observed values disagree with the decompiled formula; unresolved.
8. **Blue Rays slow amount, Purple Power 3 stop duration, Red Rockets flight model** — outside scope (economy/waves) and not extracted, though present in the same code.
9. The Wayback copy of the original Candystand instructions page could not be fetched from this environment.

---

## Corrections (2026-09-12, after re-reading the v1.2 build `ftd.swf`)

Full evidence in `vector-td-v12-verification.md`.

- **Section 3, "Bonus wording" bullet, and Gaps item 3** -- wrong. The top bar (`DefineSprite_375`)
  has six fields: BANK, INTEREST, LEVEL (written from script as `bankText`, `interestText`,
  `lvlText`) **and LIVES, SCORE, BONUS**, which are Flash variable-bound text fields
  (`DefineEditText.variableName = "_root._game.lives" / "_root._game.score" /
  "_root._game.ups"`, chars 361 / 363 / 371, static labels 364 / 366 / 374). The BONUS counter
  therefore shows `ups` directly and is part of the SWF, not the Candystand page chrome. It exists
  in v1.0 as well (chars 355 / 357 / 365, label 368). The earlier grep missed them because no
  script assigns their `.text`. `pulserA` (char 368 at 198,46) flashes beside BONUS while
  `ups > 0`.
- **Section 2, Interest step** -- confirmed again from the v1.2 handler
  (`interest += 3; ups -= 1`); the owner's "INTEREST 6% at wave 6, BONUS 0" is one purchase.
- **Section 2, "Other bonus items" / sidebar layout**: row 4 of the 4x4 tower panel is, left to
  right, DAMAGE BOOSTER (red flaming rocket), RANGE BOOSTER (green spiked star), INTEREST
  INCREASE (gold $), PANIC! (blue atom). Row 3, column 4 is an empty placeholder slot.
- **Section 1.1 type table, row 6**: the bonus cell's glyph is a yellow ring with an expanding echo
  ring (`creepShapes` frame 6); it has no display name because `creepName()` has no case for 6 and
  the panel never shows a type-6 wave.
