# Vector TD / Vector TD 2 — map and grid research

Research date: 2026-09-12. Target: David Scott's Flash games *Vector TD* (Candystand, 4 June 2007), *Vector TDx* (18 Oct 2007) and *Vector TD 2* (14 Jan 2008), for the Vector 3D tribute.

Confidence legend used throughout:

- **confirmed** — two independent sources, or read directly from the game's own data (decompiled SWF from the Internet Archive's Candystand preservation uploads).
- **single-source** — one web source only.
- **unknown** — sources silent; stated explicitly.

## Summary

- The primary source for this document is an in-game data dump. The original Candystand SWFs (`VectorDR.swf` for Vector TD, `vectortd2v32Th.swf` for Vector TD 2, `vectortdxTh.swf` for Vector TDx) were downloaded from archive.org and decompiled with JPEXS ffdec. Map names, map order, difficulty grouping, path waypoints, spawn directions, the placement grid and the mode parameters below all come from the ActionScript and display-list data, cross-checked against rendered map sprites and against web sources (Jay Is Games, Candystand blog, Games on the Web blog, Candystand wiki, YouTube walkthrough titles, RetroAchievements search snippet).
- **Vector TD has 8 maps**, all available from the start (no unlock gating in code): NORMAL MAPS — Switchback, Snaking Path, Round the Twist, Up and Down; HARDER MAPS — Elemental-ish, The Frog, Do the Splits, No Left Turns. **confirmed**
- **Vector TD 2 has 6 maps** (Pathways, Bottleneck, 2 in 1 out, Slim Pickings, Void, Ladder) and **4 modes** (Normal, Time Attack, Lightning, Puzzle/Sandbox). Maps have no difficulty labels on the select screen. **confirmed**
- **Grid**: 25 px cells; playfield 550 × 450 px = **22 columns × 18 rows**; every tower occupies exactly one cell; the map is drawn at (10, 95) on a 750 × 560 stage at 40 fps. Same in both games. **confirmed**
- **Paths**: every map defines two parallel lanes (odd-numbered and even-numbered waypoints); vectoids walk single-file along each lane. Corridors are 2 cells wide in Vector TD; Vector TD 2 mixes 2-wide and 1-wide corridors. Several maps have multiple entries/exits, splits, or crossings (details per map below). **confirmed**
- Difficulty per map is not a player-selectable mode. In Vector TD the "harder" maps (5–8) get more base HP and faster HP growth; in Vector TD 2 only Ladder (map 6) gets a slightly steeper HP curve. **confirmed** from code. A later Vector TD update reclassified the eight maps into beginner (1–2) / normal (3–5) / hard (6–8) and extended play from 40 to 50 levels; the archived Candystand SWF predates that update. **confirmed** from two web sources, but no SWF of that build was found.

## 1. Map lists

### Vector TD (v1, Candystand build `VectorDR.swf`)

Order is the on-screen order of the map-select list (`DefineSprite_491`, buttons `r1`..`r8`) and the internal map index `Level` (1..8), which also selects the frame of the map sprite `DefineSprite_325`. **confirmed** (SWF; names also appear in Jay Is Games comments, the Candystand blog FAQ, Games on the Web blog, YouTube walkthrough titles and the RetroAchievements PSP list).

| # | Name (as spelled in-game) | Select-screen group | Notes |
|---|---|---|---|
| 1 | SWITCHBACK | NORMAL MAPS | default map on first run |
| 2 | SNAKING PATH | NORMAL MAPS | |
| 3 | ROUND THE TWIST | NORMAL MAPS | |
| 4 | UP AND DOWN | NORMAL MAPS | |
| 5 | ELEMENTAL-ISH | HARDER MAPS | web sources also spell it "Elementalish" / "Elementa-lsh" |
| 6 | THE FROG | HARDER MAPS | |
| 7 | DO THE SPLITS | HARDER MAPS | |
| 8 | NO LEFT TURNS | HARDER MAPS | |

- Group labels: the select screen shows the literal text "NORMAL MAPS" above buttons 1–4 (y = 5..80) and "HARDER MAPS" above buttons 5–8 (y = 140..215). **confirmed** (SWF text + placement). Jay Is Games' review phrases this as "4 'normal' difficulty maps and 4 'harder' maps"; Games on the Web says "four normal maps and four hard maps".
- Unlock order: **none**. All eight buttons carry live `on(release)` handlers with no lock check, and the only persisted state is the last selected map in a `SharedObject` cookie. **confirmed** (SWF).
- Later reclassification: a Jay Is Games commenter reported that "before maps 1-4 were 'easy' and 5-8 were hard, now 1-2 are 'beginner', 3-5 are 'normal', and 6-8 are 'hard'" and that level count went from 40 to 50 ("it said I was on level 50 out of 40"). A 2012 strategy blog (perceptionistruth.com) independently describes "5 maps across Easy and Normal" plus "three Hard maps". **confirmed** that such a build existed; **unknown** which host carried it (the archived Candystand SWF has 40 levels and the two-group screen). See Gaps.

### Vector TDx (single-map spin-off, for context)

One map only; the SWF has a single map frame and reuses the variable value "SWITCHBACK" as a leftover. Spawn direction "up"; lane arrays `[[1,3,…,15],[2,4,…,12]]` (lanes of different length, i.e. two entries that converge). 50 levels ("200/50" HUD string). Escapegames24 commenters confirm "you can't choose your map" and "two different entry points". **confirmed**. Not researched further; out of scope.

### Vector TD 2 (`vectortd2v32Th.swf`)

Select screen has a MODES list (top) and a MAPS list (bottom). Order below is on-screen order and internal `Level` 1..6 / map-sprite frame (`DefineSprite_335`). **confirmed** (SWF; names also in Jay Is Games comments and YouTube walkthrough titles).

| # | Name | Difficulty label | Notes |
|---|---|---|---|
| 1 | PATHWAYS | none | default map |
| 2 | BOTTLENECK | none | |
| 3 | 2 IN 1 OUT | none (button text "2 in 1 out") | two entries, one exit |
| 4 | SLIM PICKINGS | none | 1-cell-wide corridors |
| 5 | VOID | none | split path, lanes of different length |
| 6 | LADDER | none | lanes cross at every rung |

- No difficulty tiers on the select screen. Player reports rank Ladder and Bottleneck as hardest (Jay Is Games comments, **single-source**).
- Unlock order: **none** (same structure as v1). **confirmed** (SWF).
- Candystand's description: "Vector is back with six new maps and four different modes." **confirmed** (Wayback copy of candystand.com/play/vector-td-2 and archive.org metadata).

### Modes (Vector TD 2 only)

Mode text (reassembled from the SWF's static text), and parameters from `setup()` in the main game script. **confirmed** (SWF).

| Mode | In-game blurb | bank | lives | interest | baseHP | notes |
|---|---|---|---|---|---|---|
| NORMAL | "Each level has different Vectoids to defeat. You have the ability to select when the next level is sent. The game is over when you run out of lives." | $275 | 20 | 3% | 600 | 50 scripted levels, bonus every 5 |
| TIME ATTACK | "A constant stream of Vectoids are sent and you only have 10 lives to defend. See how long you can last in this time attack mode!" | $275 | 10 | 0 | 220 | a new wave every 40 frames (1 s at 40 fps); vectoid type cycles every 10 waves |
| LIGHTNING | "The Vectoids move twice as fast making this the mode for hardcore Vector TD players only!" | $275 | 20 | 3% | 320 | every level uses creep type 4; all creeps get `speed = 2` |
| PUZZLE / SANDBOX | "You start with $50,000 and 2 bonuses. You get no extra funds! Once setup your score is based on how long you manage to last!" | $50,000 | 5 | 0 | 50,000 | auto-send on, kills worth $0 |

Vector TD (v1) has no modes: bank $250, 20 lives, 3% interest, bonus every 5 levels. **confirmed** (SWF).

## 2. Path layouts

### How paths are stored (both games) — **confirmed** (SWF)

- Each map is one frame of the map sprite. The frame script sets `paths = [[odd marker ids…],[even marker ids…]]` and `spawnDir` (`"up"`, `"left"` or `"right"`; `"down"`/`"leftup"` exist in code but are unused).
- Waypoints are invisible movie clips named `m1`, `m2`, … placed on the frame. `paths[0]` (odd ids) is lane A and `paths[1]` (even ids) is lane B. Each vectoid follows its lane's marker list in order, turning at each marker; reaching the last marker costs a life and the vectoid restarts from the lane's first marker.
- Spawn: vectoids are created at the first marker offset by 20 px steps against `spawnDir` (14 per lane per wave, so 28 per wave, plus a bonus power-cell vectoid every 5th level). Lanes are 20–25 px apart, i.e. both lanes fit inside one 2-cell (50 px) corridor.
- Buildability is decided by a hit-test against the map frame's `hit` sprite (a shape covering the corridor, including the coloured entry/exit cells). Everything else on the 22 × 18 grid is buildable; there are no decorative obstacles outside the corridor in either game.

Coordinates below are map-local pixels with origin at the top-left of the 550 × 450 playfield; `col = floor(x/25)`, `row = floor(y/25)` (0-based, 22 cols × 18 rows). Off-field values (−10, 460 …) are the spawn/exit markers just outside the visible grid. Corridor widths were read from the rendered map sprites (ffdec sprite export) and match the marker geometry.

ASCII sketches are rasterised from the marker data: `A` = lane A cells, `B` = lane B cells, `#` = both lanes in one cell (lanes coinciding or crossing), `.` = buildable. They show the lane centrelines, not corridor edges; where the corridor is 2 cells wide the two lanes occupy the two adjacent cells.

### Vector TD

#### 1. SWITCHBACK (Normal) — 1 entry (top), 1 exit (right), 17 turns per lane, no splits/crossings
- Entry: top edge, cols 1–2 (x ≈ 40/60). Exit: right edge, rows 15–16 (y ≈ 390/410). Corridor 2 cells wide throughout.
- Shape: a long boustrophedon — down the left, across the top to the right, back left, and so on, ending with a hook in the bottom-right.
- Lane A: (40,-10)→(40,85)→(490,85)→(490,215)→(360,215)→(360,140)→(40,140)→(40,235)→(260,235)→(260,290)→(40,290)→(40,385)→(360,385)→(360,315)→(440,315)→(440,410)→(560,410)
- Lane B: (60,-10)→(60,65)→(510,65)→(510,235)→(340,235)→(340,165)→(65,165)→(65,215)→(285,215)→(285,310)→(65,310)→(65,365)→(340,365)→(340,290)→(460,290)→(460,390)→(560,390)
```
    0123456789012345678901
 0  .AB...................
 1  .AB...................
 2  .ABBBBBBBBBBBBBBBBBBB.
 3  .AAAAAAAAAAAAAAAAAAAB.
 4  ...................AB.
 5  .AAAAAAAAAAAAAA....AB.
 6  .ABBBBBBBBBBBBA....AB.
 7  .AB..........BA....AB.
 8  .ABBBBBBBBBB.BAAAAAAB.
 9  .AAAAAAAAAAB.BBBBBBBB.
10  ..........AB..........
11  .AAAAAAAAAAB.BBBBBB...
12  .ABBBBBBBBBB.BAAAAB...
13  .AB..........BA..AB...
14  .ABBBBBBBBBBBBA..AB...
15  .AAAAAAAAAAAAAA..ABBBB
16  .................AAAAA
17  ......................
```

#### 2. SNAKING PATH (Normal) — 1 entry (top), 1 exit (right), 21 turns per lane
- Entry: top edge, cols 5–6. Exit: right edge, rows 8–9 (y ≈ 215/240). Corridor 2 cells wide.
- Shape: irregular snake — a loop in the top-left, a bump across the top-right, a staircase down the middle, a long run along the bottom, then up the right edge to the exit.
- Lane A: (140,-10)→(140,65)→(40,65)→(40,185)→(260,185)→(260,85)→(435,85)→(435,140)→(340,140)→(340,265)→(240,265)→(240,315)→(40,315)→(40,410)→(360,410)→(360,365)→(415,365)→(415,410)→(510,410)→(510,240)→(560,240)
- Lane B: (160,-10)→(160,85)→(65,85)→(65,165)→(240,165)→(240,65)→(460,65)→(460,160)→(360,160)→(360,285)→(260,285)→(260,335)→(60,335)→(60,385)→(340,385)→(340,340)→(435,340)→(435,390)→(490,390)→(490,215)→(560,215)
```
    0123456789012345678901
 0  .....AB...............
 1  .....AB...............
 2  .AAAAAB..BBBBBBBBBB...
 3  .ABBBBB..BAAAAAAAAB...
 4  .AB......BA......AB...
 5  .AB......BA..AAAAAB...
 6  .ABBBBBBBBA..ABBBBB...
 7  .AAAAAAAAAA..AB.......
 8  .............AB....BBB
 9  .............AB....BAA
10  .........AAAAAB....BA.
11  .........ABBBBB....BA.
12  .AAAAAAAAAB........BA.
13  .ABBBBBBBBB..BBBBB.BA.
14  .AB..........BAAAB.BA.
15  .ABBBBBBBBBBBBA.ABBBA.
16  .AAAAAAAAAAAAAA.AAAAA.
17  ......................
```

#### 3. ROUND THE TWIST (Normal) — 1 entry (left), 1 exit (bottom), **crossing path**
- Entry: left edge, rows 1–2 (y ≈ 40/60). Exit: bottom edge, cols 13–14 (x ≈ 340/360). Corridor 2 cells wide.
- Shape: a clockwise inward spiral (three rings). From the centre the final leg runs straight down and **crosses the two lower rings** of the spiral (rows 12–13 and 15–16 at cols 13–14). The rendered sprite draws the crossing with dashed corridor edges. This is the only crossing in Vector TD.
- Lane A: (-10,40)→(505,40)→(505,407)→(45,407)→(45,115)→(430,115)→(430,335)→(115,335)→(115,195)→(360,195)→(360,460)
- Lane B: (-10,60)→(490,60)→(490,392)→(60,392)→(60,135)→(415,135)→(415,315)→(135,315)→(135,210)→(340,210)→(340,460)
```
    0123456789012345678901
 0  ......................
 1  AAAAAAAAAAAAAAAAAAAAA.
 2  BBBBBBBBBBBBBBBBBBBBA.
 3  ...................BA.
 4  .AAAAAAAAAAAAAAAAA.BA.
 5  .ABBBBBBBBBBBBBBBA.BA.
 6  .AB.............BA.BA.
 7  .AB.AAAAAAAAAAA.BA.BA.
 8  .AB.ABBBBBBBBBA.BA.BA.
 9  .AB.AB.......BA.BA.BA.
10  .AB.AB.......BA.BA.BA.
11  .AB.AB.......BA.BA.BA.
12  .AB.ABBBBBBBBB#BBA.BA.
13  .AB.AAAAAAAAA#AAAA.BA.
14  .AB..........BA....BA.
15  .ABBBBBBBBBBBB#BBBBBA.
16  .AAAAAAAAAAAA#AAAAAAA.
17  .............BA.......
```

#### 4. UP AND DOWN (Normal) — 1 entry (right), 1 exit (right), comb shape
- Entry: right edge, rows 1–2 (spawnDir "right", vectoids enter travelling left). Exit: right edge, rows 15–16. Corridor 2 cells wide.
- Shape: across the top to the left, down the left edge, then three tall U-turns (a comb with teeth pointing up) along the bottom, exiting bottom-right.
- Lane A: (550,40)→(40,40)→(40,410)→(160,410)→(160,160)→(240,160)→(240,410)→(360,410)→(360,160)→(440,160)→(440,410)→(560,410)
- Lane B: (550,60)→(60,60)→(60,390)→(140,390)→(140,140)→(260,140)→(260,390)→(340,390)→(340,140)→(460,140)→(460,390)→(560,390)
```
    0123456789012345678901
 0  ......................
 1  .AAAAAAAAAAAAAAAAAAAAA
 2  .ABBBBBBBBBBBBBBBBBBBB
 3  .AB...................
 4  .AB...................
 5  .AB..BBBBBB..BBBBBB...
 6  .AB..BAAAAB..BAAAAB...
 7  .AB..BA..AB..BA..AB...
 8  .AB..BA..AB..BA..AB...
 9  .AB..BA..AB..BA..AB...
10  .AB..BA..AB..BA..AB...
11  .AB..BA..AB..BA..AB...
12  .AB..BA..AB..BA..AB...
13  .AB..BA..AB..BA..AB...
14  .AB..BA..AB..BA..AB...
15  .ABBBBA..ABBBBA..ABBBB
16  .AAAAAA..AAAAAA..AAAAA
17  ......................
```

#### 5. ELEMENTAL-ISH (Harder) — 1 entry (top), 1 exit (top)
- Entry: top edge, cols 3–4 (x ≈ 90/110). Exit: **top edge**, cols 7–8 (x ≈ 190/210) — the path leaves the way it came in. Corridor 2 cells wide.
- Shape: down the left, a small loop, a wide meander across the middle, along the bottom, up the right edge and back along the top to the exit.
- Lane A: (90,-10)→(90,65)→(40,65)→(40,210)→(210,210)→(210,160)→(390,160)→(390,290)→(40,290)→(40,410)→(510,410)→(510,40)→(210,40)→(210,-10)
- Lane B: (110,-10)→(110,85)→(60,85)→(60,190)→(190,190)→(190,140)→(410,140)→(410,310)→(60,310)→(60,390)→(490,390)→(490,60)→(190,60)→(190,-10)
```
    0123456789012345678901
 0  ...AB..BA.............
 1  ...AB..BAAAAAAAAAAAAA.
 2  .AAAB..BBBBBBBBBBBBBA.
 3  .ABBB..............BA.
 4  .AB................BA.
 5  .AB....BBBBBBBBBB..BA.
 6  .AB....BAAAAAAAAB..BA.
 7  .ABBBBBBA......AB..BA.
 8  .AAAAAAAA......AB..BA.
 9  ...............AB..BA.
10  ...............AB..BA.
11  .AAAAAAAAAAAAAAAB..BA.
12  .ABBBBBBBBBBBBBBB..BA.
13  .AB................BA.
14  .AB................BA.
15  .ABBBBBBBBBBBBBBBBBBA.
16  .AAAAAAAAAAAAAAAAAAAA.
17  ......................
```

#### 6. THE FROG (Harder) — **2 entries (top-left, top-right), 2 exits (bottom-left, bottom-right)**, lanes merge in the middle
- Lane A enters top edge at col 2 (x = 50); lane B enters top edge at col 20 (x = 500). Each lane follows a mirror-image route into a shared central stem (cols 10–11, rows 2–14) where the two lanes run side by side, then they diverge again: lane A exits bottom edge at col 3 (x = 75), lane B at col 19 (x = 475).
- Corridors are 2 cells wide even where only one lane uses them; the whole figure is left-right symmetric.
- Lane A: (50,-10)→(50,125)→(145,125)→(145,50)→(265,50)→(265,350)→(175,350)→(175,200)→(75,200)→(75,460)
- Lane B: (500,-10)→(500,125)→(400,125)→(400,50)→(285,50)→(285,350)→(375,350)→(375,200)→(475,200)→(475,460)
```
    0123456789012345678901
 0  ..A.................B.
 1  ..A.................B.
 2  ..A..AAAAAABBBBBB...B.
 3  ..A..A....AB....B...B.
 4  ..A..A....AB....B...B.
 5  ..AAAA....AB....BBBBB.
 6  ..........AB..........
 7  ..........AB..........
 8  ...AAAAA..AB...BBBBB..
 9  ...A...A..AB...B...B..
10  ...A...A..AB...B...B..
11  ...A...A..AB...B...B..
12  ...A...A..AB...B...B..
13  ...A...A..AB...B...B..
14  ...A...AAAABBBBB...B..
15  ...A...............B..
16  ...A...............B..
17  ...A...............B..
```

#### 7. DO THE SPLITS (Harder) — 1 entry, 1 exit, **split path** (lanes take opposite sides of a rectangle)
- Entry: top edge, cols 3–4 (x ≈ 93/108). Exit: bottom edge, cols 17–18 (x ≈ 442/454).
- After entering, lane A goes straight down the left side (col 3, corridor cols 3–4) then right along the bottom (row 14, corridor rows 13–14); lane B goes right along the top (row 4, corridor rows 3–4) then down the right side (col 18, corridor cols 17–18). They rejoin in the bottom-right corner and exit together. Net effect: a big hollow rectangle with vectoids circulating on both sides; the inside is buildable.
- Lane A: (93,-10)→(93,100)→(93,150)→(93,350)→(442,350)→(442,460)
- Lane B: (108,-10)→(108,100)→(454,100)→(454,300)→(454,350)→(454,460)
```
    0123456789012345678901
 0  ...AB.................
 1  ...AB.................
 2  ...AB.................
 3  ...AB.................
 4  ...ABBBBBBBBBBBBBBB...
 5  ...A..............B...
 6  ...A..............B...
 7  ...A..............B...
 8  ...A..............B...
 9  ...A..............B...
10  ...A..............B...
11  ...A..............B...
12  ...A..............B...
13  ...A..............B...
14  ...AAAAAAAAAAAAAAAB...
15  .................AB...
16  .................AB...
17  .................AB...
```

#### 8. NO LEFT TURNS (Harder) — **2 entries (left), 2 exits (bottom)**, two disjoint L-shaped corridors
- Lane A enters left edge at row 3 (y = 75), runs right to col 19 (x = 475) and turns down to exit at the bottom (cols 18–19). Lane B enters left edge at row 6 (y = 150), runs right to col 16 (x = 400) and turns down to exit at cols 15–16. Each lane makes exactly one right turn (hence the name).
- Each corridor is 2 cells wide; the two corridors are separated by a 1-cell buildable gap (row 4 between the horizontals, col 17 between the verticals). Only 3 waypoints per lane — the shortest path in the game, which is why it is regarded as the hardest (Candystand blog: "Level 3 on the No Left Turns board kicked my butt"; Jay Is Games commenters: "insanely difficult").
- Lane A: (-10,75)→(475,75)→(475,460)
- Lane B: (-10,150)→(400,150)→(400,460)
```
    0123456789012345678901
 0  ......................
 1  ......................
 2  ......................
 3  AAAAAAAAAAAAAAAAAAA...
 4  ..................A...
 5  ..................A...
 6  BBBBBBBBBBBBBBBBB.A...
 7  ................B.A...
 8  ................B.A...
 9  ................B.A...
10  ................B.A...
11  ................B.A...
12  ................B.A...
13  ................B.A...
14  ................B.A...
15  ................B.A...
16  ................B.A...
17  ................B.A...
```

### Vector TD 2

#### 1. PATHWAYS — 1 entry (left), **2 exits (bottom)**, lanes separate around 1-cell islands
- Entry: left edge, rows 2–3 (2-wide corridor). The lanes run right along the top, then turn down the right side where they **separate into two 1-cell corridors** (lane A col 19, lane B col 17) with a buildable 1-cell island between them (col 18, rows 4–10). They rejoin into a 2-wide corridor heading left along rows 10–11, then split again into two 1-cell corridors going down (lane A col 7, lane B col 5, island col 6) to **two separate exits** on the bottom edge.
- Lane A: (-10,65)→(486,65)→(486,285)→(188,285)→(188,465)
- Lane B: (-10,85)→(437,85)→(437,265)→(137,265)→(137,465)
```
    0123456789012345678901
 0  ......................
 1  ......................
 2  AAAAAAAAAAAAAAAAAAAA..
 3  BBBBBBBBBBBBBBBBBB.A..
 4  .................B.A..
 5  .................B.A..
 6  .................B.A..
 7  .................B.A..
 8  .................B.A..
 9  .................B.A..
10  .....BBBBBBBBBBBBB.A..
11  .....B.AAAAAAAAAAAAA..
12  .....B.A..............
13  .....B.A..............
14  .....B.A..............
15  .....B.A..............
16  .....B.A..............
17  .....B.A..............
```

#### 2. BOTTLENECK — **2 entries (top), 1 exit (bottom)**, merge then a loop around an island
- Lane A enters top edge at col 15 (x = 375), lane B at col 7 (x = 175); both corridors 2 cells wide. They meet at row 7 in a horizontal bar and merge into a 2-wide neck (cols 10–11) heading down. At rows 10–14 the lanes split around a central island (lane A right side col 13, lane B left side col 8; ring corridor 1 cell wide) and rejoin into a 2-wide exit corridor (cols 10–11) to the bottom edge.
- Lane A: (375,-15)→(375,175)→(285,175)→(285,262)→(336,262)→(336,362)→(285,362)→(285,465)
- Lane B: (175,-10)→(175,175)→(265,175)→(265,262)→(213,262)→(213,362)→(265,362)→(265,465)
```
    0123456789012345678901
 0  .......B.......A......
 1  .......B.......A......
 2  .......B.......A......
 3  .......B.......A......
 4  .......B.......A......
 5  .......B.......A......
 6  .......B.......A......
 7  .......BBBBAAAAA......
 8  ..........BA..........
 9  ..........BA..........
10  ........BBBAAA........
11  ........B....A........
12  ........B....A........
13  ........B....A........
14  ........BBBAAA........
15  ..........BA..........
16  ..........BA..........
17  ..........BA..........
```

#### 3. 2 IN 1 OUT — **2 entries (top), 1 exit (bottom-right)**
- Lane A enters top edge at col 11 (x = 275), lane B at col 7 (x = 175); both prongs are 2-wide corridors running straight down to row 8, where a 2-wide bar joins them. Both lanes then squeeze single-file through a **1-cell-wide neck** at col 8 (x = 212, rows 9–11), spread back to a 2-wide bar along rows 12–13 heading right, and exit down a 2-wide corridor at cols 16–17.
- Lane A: (275,-10)→(275,212)→(212,212)→(212,312)→(438,312)→(438,465)
- Lane B: (175,-10)→(175,212)→(212,212)→(212,337)→(415,337)→(415,465)
```
    0123456789012345678901
 0  .......B...A..........
 1  .......B...A..........
 2  .......B...A..........
 3  .......B...A..........
 4  .......B...A..........
 5  .......B...A..........
 6  .......B...A..........
 7  .......B...A..........
 8  .......B#AAA..........
 9  ........#.............
10  ........#.............
11  ........#.............
12  ........#AAAAAAAAA....
13  ........BBBBBBBBBA....
14  ................BA....
15  ................BA....
16  ................BA....
17  ................BA....
```

#### 4. SLIM PICKINGS — **2 entries (left), 1 exit (bottom-right)**, all corridors 1 cell wide
- Lane B enters left edge at row 2 (y = 62), lane A at row 4 (y = 112); each in its own 1-cell corridor. They merge at col 15 and from there both lanes share identical waypoints (single file) through a wide boustrophedon: down to row 7, left to col 7, down to row 10, right to col 19, down to row 13, left to col 2, down to row 16, right to col 20, exit at the bottom edge (col 20).
- Because the corridor is 1 cell wide, the buildable area is large but towers sit only on one side of each leg — the "slim pickings" is about range coverage, not space. (Jay Is Games comments call it completable / one of the easier ones; **single-source**.)
- Lane A: (-10,112)→(388,112)→(388,188)→(188,188)→(188,262)→(488,262)→(488,338)→(63,338)→(63,412)→(513,412)→(513,460)
- Lane B: (-10,62)→(388,62)→ then identical to lane A from (388,188)
```
    0123456789012345678901
 0  ......................
 1  ......................
 2  BBBBBBBBBBBBBBBB......
 3  ...............B......
 4  AAAAAAAAAAAAAAA#......
 5  ...............#......
 6  ...............#......
 7  .......#########......
 8  .......#..............
 9  .......#..............
10  .......#############..
11  ...................#..
12  ...................#..
13  ..##################..
14  ..#...................
15  ..#...................
16  ..###################.
17  ....................#.
```

#### 5. VOID — 1 entry (top), 1 exit (bottom-right), **split path with unequal lanes**
- Entry: top edge, cols 3–4 (2-wide stem, rows 0–4). At row 4 the lanes split. Lane A (short route, 6 waypoints) turns right along row 4, up to row 2, right to col 20 and down the right edge. Lane B (long route, 9 waypoints) continues down col 3 to row 15, right along the bottom to col 18, up to row 10, left to col 14, up to row 6, right to col 20 where it merges into lane A's right-edge corridor. Both exit at the bottom edge, col 20.
- All corridors after the entry stem are 1 cell wide. Lane B's route is roughly 2.5× longer than lane A's, so the two halves of each wave arrive at the exit far apart. (Marker ids 13, 15, 17 are unused on this frame.)
- Lane A: (110,-10)→(110,112)→(288,112)→(288,62)→(512,62)→(512,465)
- Lane B: (88,-10)→(88,112)→(88,387)→(462,387)→(462,262)→(365,262)→(365,162)→(512,162)→(512,465)
```
    0123456789012345678901
 0  ...BA.................
 1  ...BA.................
 2  ...BA......AAAAAAAAAA.
 3  ...BA......A........A.
 4  ...BAAAAAAAA........A.
 5  ...B................A.
 6  ...B..........BBBBBB#.
 7  ...B..........B.....#.
 8  ...B..........B.....#.
 9  ...B..........B.....#.
10  ...B..........BBBBB.#.
11  ...B..............B.#.
12  ...B..............B.#.
13  ...B..............B.#.
14  ...B..............B.#.
15  ...BBBBBBBBBBBBBBBB.#.
16  ....................#.
17  ....................#.
```

#### 6. LADDER — **2 entries (top), 2 exits (bottom), lanes cross at every rung**
- Two vertical 1-cell rails at col 9 (x = 238) and col 12 (x = 313), joined by five 1-cell-tall rungs at rows 3, 6, 9, 12 and 15 (each rung spans cols 9–12). Lane A enters at the top of the right rail, lane B at the top of the left rail. At each rung both lanes swap rails — lane A goes right→left while lane B goes left→right through the same rung — so the lanes **physically cross** in the middle of every rung. Lane A exits at the bottom of the left rail, lane B at the bottom of the right rail.
- The 2 × 2 holes between rungs (cols 10–11) are buildable islands: a tower there is in range of both rails and two rungs.
- Lane A: (313,-10)→(313,88)→(238,88)→(238,163)→(313,163)→(313,238)→(238,238)→(238,312)→(313,312)→(313,387)→(238,387)→(238,460)
- Lane B: (238,-10)→(238,88)→(313,88)→(313,163)→(238,163)→(238,238)→(313,238)→(313,312)→(238,312)→(238,387)→(313,387)→(313,460)
```
    0123456789012345678901
 0  .........B..A.........
 1  .........B..A.........
 2  .........B..A.........
 3  .........####.........
 4  .........A..B.........
 5  .........A..B.........
 6  .........####.........
 7  .........B..A.........
 8  .........B..A.........
 9  .........####.........
10  .........A..B.........
11  .........A..B.........
12  .........####.........
13  .........B..A.........
14  .........B..A.........
15  .........####.........
16  .........A..B.........
17  .........A..B.........
```

### Topology summary

| Game | Map | Entries | Exits | Split | Crossing | Corridor width |
|---|---|---|---|---|---|---|
| TD | Switchback | 1 top | 1 right | no | no | 2 |
| TD | Snaking Path | 1 top | 1 right | no | no | 2 |
| TD | Round the Twist | 1 left | 1 bottom | no | **yes** (exit leg crosses 2 rings) | 2 |
| TD | Up and Down | 1 right | 1 right | no | no | 2 |
| TD | Elemental-ish | 1 top | 1 top | no | no | 2 |
| TD | The Frog | **2** top | **2** bottom | lanes merge then diverge | no | 2 |
| TD | Do the Splits | 1 top | 1 bottom | **yes** (rectangle) | no | 2 |
| TD | No Left Turns | **2** left | **2** bottom | two disjoint paths | no | 2 |
| TD2 | Pathways | 1 left | **2** bottom | lanes part around islands | no | 2 / 1 |
| TD2 | Bottleneck | **2** top | 1 bottom | ring around island | no | 2 / 1 |
| TD2 | 2 in 1 out | **2** top | 1 bottom | no | no | 2 / 1 (neck) |
| TD2 | Slim Pickings | **2** left | 1 bottom | no | no | 1 |
| TD2 | Void | 1 top | 1 bottom | **yes** (unequal lanes) | no | 2 stem, then 1 |
| TD2 | Ladder | **2** top | **2** bottom | no | **yes** (every rung) | 1 |

All **confirmed** (SWF marker data + rendered sprites; web sources corroborate the two-entry nature of The Frog / No Left Turns / 2 in 1 out and the "two entryway maps" being hard).

## 3. Grid facts — **confirmed** (SWF code; identical in Vector TD and Vector TD 2)

- **Stage**: 750 × 560 px, SWF version 8, 40 fps (both games; Vector TDx too).
- **Playfield**: the map sprite is placed at (10, 95) inside the game sprite; its background shape is exactly 550 × 450 px with a drawn 25 px grid. The sidebar occupies the remaining 190 px on the right and the top bar the top 95 px.
- **Cell size**: 25 × 25 px. The tower placer snaps to `int((mouse - w/2) / 25) * 25` on both axes and only shows when `0 <= X < 550 && 0 <= Y < 450`, i.e. **22 columns × 18 rows = 396 cells**.
- **One tower per cell**: a tower's `_x/_y` is the snapped cell origin; the range "radar" is centred at (+12.5, +12.5); placement is refused if `towerArray` already has a tower with the same `_x,_y`. Towers never straddle cells and there is no larger tower footprint.
- **Unbuildable cells**: the placer hit-tests the map frame's `hit` sprite at the cell's interior point (`_map.hit.hitTest(X+25, Y+100, true)`, in stage coordinates). The `hit` sprite is the corridor polygon including the green entry and red exit cells, so exactly the corridor is unbuildable and every other cell is buildable. No map has extra blocked cells or decorations.
- **Lane spacing**: the two lanes are 20–25 px apart, both inside the corridor; creeps spawn 20 px apart in a column of 14 per lane per wave.
- Vector TD `levels` array has 40 entries (HUD "200/40", win text "ALL 40 LEVELS"); Vector TD 2 and TDx have 50 ("200/50"). **confirmed** for these builds.

## 4. Difficulty modes per map

- **No per-map easy/medium/hard selector exists in either game.** Difficulty is a property of the map (and, in TD2, of the chosen mode). **confirmed** (SWF: the only persisted choices are `Level` = map index and, in TD2, `Mode`).
- **Vector TD**: maps 5–8 ("HARDER MAPS") differ from 1–4 in code, not only in layout:
  - starting `baseHP` 650 vs 550;
  - per-level growth `baseHP += baseHP/5` vs `baseHP/6`;
  - displayed wave HP `baseHP + baseHP/4` vs `baseHP + baseHP/5`.
  Everything else (cash, lives, interest, bonuses, 40 levels, wave composition) is identical across maps. **confirmed** (SWF).
- **Vector TD (later build)**: reclassified into beginner (1–2), normal (3–5), hard (6–8) and extended to 50 levels; whether the HP scaling changed with it is **unknown** (no SWF found).
- **Vector TD 2**: after each wave `baseHPincrease` (the divisor in `baseHP += baseHP / baseHPincrease`) grows by +0.03 on maps 1–5 but only +0.02 on map 6 (Ladder), so Ladder's HP curve stays steeper for longer. No other per-map differences. Modes change starting cash, lives, interest, HP and creep speed as tabulated in section 1. **confirmed** (SWF).
- Player-perceived difficulty (all **single-source**, from comments): TD — No Left Turns and The Frog hardest, Switchback easiest; TD2 — Ladder and Bottleneck hardest, Slim Pickings completable.

## Sources

Primary / data:
- https://archive.org/details/vector_td — Internet Archive upload of the Candystand `VectorDR.swf` (Vector TD; "released onto Candystand.com on June 4, 2007, where it remained until the website was discontinued on January 1, 2016"). Source of every v1 map name, waypoint, grid and scaling fact above (decompiled locally with JPEXS ffdec; working files in `/tmp/vtd/`).
- https://archive.org/details/vectortd2v32Th — same for Vector TD 2 (`vectortd2v32Th.swf`, released 14 Jan 2008): six maps, four modes, mode parameters, waypoints.
- https://archive.org/details/vector_tdx — Vector TDx (18 Oct 2007): single map, 50 levels.
- Wayback Machine copies of http://www.candystand.com/play/vector-td (2009-06-11) and http://www.candystand.com/play/vector-td-2 (2009-06-07, 2011-10-19), read via the CDX API: official descriptions and instructions ("Select a map from the list, click on Load Map…"; "Vector is back with six new maps and four different modes"; TD2 credited to "David Scott and The WDDG").

Secondary:
- https://jayisgames.com/review/vector-td.php — review ("4 'normal' difficulty maps and 4 'harder' maps") and comments naming Switchback, Round the Twist, Snaking Path, Elemental-ish, No Left Turns, The Frog; the 40→50 level update and the beginner/normal/hard reclassification quote.
- https://jayisgames.com/review/vector-td-2.php — comments naming Slim Pickings, Ladder, Pathways, Bottleneck, 2 in 1 out; mode descriptions; player difficulty ranking.
- http://candystandblog.blogspot.com/2007/06/vector-td-faq.html — Candystand launch FAQ; "No Left Turns" cited as the board that "kicked my butt".
- http://gamesontheweb.blogspot.com/2007/06/vector-td-tower-defense.html — "four normal maps and four hard maps"; Elemental-ish is "the first hard map"; Frog comments.
- https://perceptionistruth.com/2012/02/beating-vector-td-easy-and-normal/ — strategy guide covering "5 maps across Easy and Normal" and "three Hard maps" (evidence of the reclassified build); no map names.
- https://candystand.fandom.com/wiki/Vector_TD (via api.php) — short tower summary only; no map data.
- https://en.wikipedia.org/wiki/Vector_TD — release/port history ("splits levels across three difficulty levels"; PSP/PS3/iPhone ports); no map names.
- https://retroachievements.org/game/7420 (PSP port; search snippet only, page blocks fetching) — lists Round the Twist, Switchback, Snaking Path as easier maps and Elementa-lsh, The Frog, Do the Splits, No Left Turns as harder; "complete all 50 levels" achievements (PSP build has 50 levels).
- https://www.escapegames24.com/2007/06/vector-td-tower-defence.html and https://www.escapegames24.com/2007/12/vector-tdx.html — comments: "two entryway maps" are hardest; TDx is single-map with "two different entry points".
- https://www.mtgsalvation.com/forums/retired-forums/retired-forums/entertainment-archive/453920-help-with-vector-td — The Frog help thread (existence/difficulty only).
- YouTube walkthrough titles found via search (not fetchable): "Vector TD Switchback Walkthrough", "Vector TD Walkthrough (map-Snakingpath)", "Vector TD Walkthrough Map: Elemental-Ish", "Vector TD Do The Splits 40/40", "Vector TD - Walkthrough - The Frog", "Vector TD 2 - Pathways - Full Walkthrough", "Vector TD 2 Ladder Level 31 to 40", "Vector TD 2 Bottleneck 1-3", "Vector TD 2 Walkthrough - Slim Pickings level 1 - 50". Corroborate names and the 40-level v1 / 50-level v2 counts.

Blocked / unavailable: candystand.fandom.com HTML (Cloudflare), retroachievements.org and exophase.com (403), forum threads on totalwar.org / twoplustwo / uacc.club (403), YouTube pages (no content), kongregate.com/games/braichuski/vector-td (a broken re-upload, "no more game"), web.archive.org was intermittently offline during the session.

## Gaps

1. **The reclassified 50-level Vector TD build** (beginner/normal/hard, "level 50 out of 40") was not found as a SWF. Which host served it (Candystand update, David Scott's own site, Kongregate mirrors) and whether its per-map HP scaling differs are unknown. The archived Candystand SWF is the 40-level, two-group build.
2. **Version numbers**: neither SWF contains a game version string (the `v1.2` / `2.0.2.126` strings are the tracking wrapper and Flash UI component versions). The exact "v1.x" numbering used by Candystand is unknown.
3. **Corridor polygons** were read from rendered sprites, not extracted as exact cell masks. The waypoint data is exact; corridor edges (2-wide vs 1-wide) are visually verified but a cell-by-cell buildable mask would need the `hit` shape records decoded from the SWF.
4. **Vector TDx** map geometry was not dumped (out of scope); only its lane arrays and single-map nature were checked.
5. **PSP / iPhone ports**: the PSP build reportedly has 50 levels per map and the same eight maps, but no port data was examined.
6. Community "difficulty" rankings and strategy notes are anecdotal (single comments); no aggregated data exists.
