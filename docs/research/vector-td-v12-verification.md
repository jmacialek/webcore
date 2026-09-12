# Vector TD v1.2 -- verification against the owner's screenshot

Research notes for the Vector 3D tribute. Compiled 2026-09-12.

Build verified: `/tmp/vtd/ftd.swf`, frame-1 script `version = "v1.2"`. Decompiled with JPEXS
FFDec (`-export script`, `-export text`, `-swf2xml`, `-export sprite` at 4x zoom). All script
paths below are under `/tmp/vtd/out_ftd/scripts/`; game logic is `DefineSprite_536`, the sidebar
is `DefineSprite_457`, the top bar is `DefineSprite_375`. `VectorDR.swf` (v1.0) was consulted only
to phrase the corrections precisely.

Confidence legend: **confirmed** = read from decompiled v1.2 code / sprite data;
**single-source** = one web source only; **unknown** = not found.

## Summary

The owner's screenshot is right and the earlier notes were wrong on two points:

1. **v1.2 has the TARGET LOCKING ON/OFF toggle.** The notes said it first appeared in TDx/TD2.
   It is absent only in v1.0.
2. **The top bar has a BONUS counter bound to `_root._game.ups`**, plus LIVES and SCORE fields bound
   the same way. The notes missed them because they are *variable-bound* text fields
   (`DefineEditText.variableName`), not `.text =` assignments in script. v1.0 has them too.

Everything else the owner described (4x4 sidebar layout, row 4 = Damage Booster / Range Booster /
Interest Increase / Panic!, "Costs 1 bonus point", Blue towers fixed to FASTEST, INTEREST 6% after
one purchase) is confirmed from code and sprites.

---

## 1. Target Locking in v1.2 -- confirmed

### 1.1 Which towers expose it

Each tower script sets two flags (`DefineSprite_<id>_tower_*/frame_1/DoAction.as` lines 12-13):

| Tower (sprite) | `targetLocking` | `targetLock` default | `targetMode` default | Lock button shows |
|---|---|---|---|---|
| RED REFRACTOR (`tower_brown`, 101) | `true` | `true` | `"closest"` | ON/OFF, clickable |
| RED ROCKETS (`tower_red`, 135) | `true` | `true` | `"hardest"` | ON/OFF, clickable |
| PURPLE POWER 1 (`tower_pink1`, 123) | `true` | `true` | `"hardest"` | ON/OFF, clickable |
| PURPLE POWER 2 (`tower_pink2`, 127) | `true` | `true` | `"hardest"` | ON/OFF, clickable |
| PURPLE POWER 3 (`tower_pink3`, 131) | `true` | `true` | `"hardest"` | ON/OFF, clickable |
| GREEN LASER 1/2/3 (108/112/116) | `false` | (none) | `"closest"` | greyed "TARGET LOCKING ON" |
| LITTLE RED SPAMMER (`tower_swarm`, 139) | `false` | (none) | `"random"` | greyed |
| BLUE RAYS 1 (`tower_blue`, 94) | `false` | (none) | `"fastest"` | greyed |
| BLUE RAYS 2 (`tower_bash`, 90) | `false` | (none) | `"fastest"` | greyed |

Default is **ON** for every tower that has it. A new tower of the same type always starts ON;
the setting is per tower instance, not remembered.

### 1.2 The UI

`showInfo(n)` (`DefineSprite_536/frame_1/DoAction.as` ~1510-1525):

```
if(n.targetLocking == true) {
   if(n.targetLock == true) _ui.sidebar.button_acquire.gotoAndStop(1);   // "TARGET LOCKING ON"  (green ON)
   else                     _ui.sidebar.button_acquire.gotoAndStop(2);   // "TARGET LOCKING OFF" (red OFF)
} else {
   _ui.sidebar.button_acquire.gotoAndStop(3);   // "TARGET LOCKING ON" + `cover` overlay = greyed out
}
```

`button_acquire` is `DefineSprite_452` (placed at sidebar x=8, y=347). Frame 1 text = char 449
"TARGET LOCKING <green>ON</green>", frame 2 = char 450 "TARGET LOCKING <red>OFF</red>", frame 3 =
char 451 (ON text) plus char 418 `cover` and no click handler. Click handlers
(`DefineSprite_452/frame_{1,2}/PlaceObject2_420_1/... on(release).as`):

- frame 1 (currently ON): `_parent.what.targetLock = false; gotoAndStop(2)`
- frame 2 (currently OFF): `_parent.what.targetLock = true; gotoAndStop(1)`

Both are gated on `_root._game.Paused == 0`. Toggling is free and does not clear the current target.

### 1.3 What ON vs OFF does (fire logic)

The five lock-capable towers share this cycle (`tower_brown` / `tower_red` lines 33-100,
`tower_pink*` similar):

```
if(stepper == 0) {
   stepper = rof;
   if(targetLock == false) { creep = ""; }        // <-- the only thing OFF changes
   if("" + creep == "") {
      // scan creepArray (spawn order) for on-screen vectoids within buffedRange,
      // pick by targetMode: closest = min dist, weakest = min hp, hardest = max hp
      // (strict < / > with qualifier==0 sentinel => first-in-array wins ties)
      if none: stepper = 2 (retry in 2 frames)   [Purple: stepper = 0, retry next frame]
      else:    fire(...)
   } else {
      // held target: drop it if out of range or off screen, else fire at it
   }
}
```

- **ON** (`targetLock == true`): the tower keeps `creep` between shots. It re-selects only when the
  held target dies (`kill()` splices it out and `removeMovieClip()`s it, so the range check fails)
  or leaves `buffedRange` / the 550x450 screen.
- **OFF** (`targetLock == false`): `creep` is cleared at the start of *every* firing cycle
  (every `rof` frames: Refractor 10, Rockets 45, Purple 40), so the CLOSE/HARD/WEAK comparison
  is re-run for every shot. In practice: Refractor OFF+CLOSE hoses whatever is nearest right now;
  Rockets OFF+WEAK sends each rocket at the current lowest-HP vectoid (the Perception Is Truth
  tactic); Purple OFF+HARD retargets the healthiest each 40-frame charge.

Changing the fire mode (CLOSE/HARD/WEAK buttons, `DefineSprite_448`) always sets
`what.creep = ""` so the new mode takes effect immediately regardless of lock state.

Green Lasers have no `targetLock` field; their loop (`tower_green` lines 30-95) holds `creep` until
it dies or leaves range, then waits 10 frames and re-selects by mode. This is effectively "always
locked" and matches the greyed-out ON label. Spammer and Blue Rays re-select every shot by
construction.

### 1.4 Which towers have CLOSE / HARD / WEAK greyed out

Owner's claim ("Blue towers only target fast ones") -- **confirmed**, with detail. The
`button_firemode` sprite (`DefineSprite_448`, sidebar x=8, y=327) has three frames:

| Frame | Shown for | Content |
|---|---|---|
| 1 | Green Lasers, Red Refractor, Red Rockets, Purple Powers | three buttons CLOSE / HARD / WEAK (`m1`/`m2`/`m3`, chars 436/441/444, text 435/440/443); the active one is highlighted via `gotoAndStop(2)` |
| 2 | Little Red Spammer (`targetMode == "random"`) | single static label **RANDOM** (char 446) |
| 3 | Blue Rays 1 and 2 (`targetMode == "fastest"`) | single static label **FASTEST** (char 447) |

So for Blue towers the mode row is *replaced* by a FASTEST label (not three greyed buttons), and
the lock row shows the greyed "TARGET LOCKING ON". What FASTEST means in code:

- **Blue Rays 2** (`tower_bash`): one target per 120 frames, `C.speed > qualifier` -- strictly the
  highest *current* speed in range; ties to earliest-spawned. Yellow Sprinters (speed 2) win when
  present and unslowed.
- **Blue Rays 1** (`tower_blue`): up to 4 targets per 40 frames. First pass takes vectoids in array
  order whose `speed == maxSpeed` (not yet slowed); second pass fills remaining slots with anything
  in range. "Fastest" here means "prefer un-slowed", not a speed sort.

Neither Blue tower reads `targetMode` in its fire loop; the value only drives the UI.

---

## 2. BONUS counter in the top bar -- confirmed (refutes the notes)

The top bar is `DefineSprite_375` (placed in `DefineSprite_534`). Its layout (x,y in px within the
sprite, from the XML placement matrices):

| Static label (DefineText) | Position | Value field (DefineEditText) | Position | Bound to |
|---|---|---|---|---|
| 373 "BANK" | 5, 6 | 370 `bankText` | 21, 6 | script: `bankText.text = "$" + _root._game.bank` |
| 364 "LIVES" | 117, 6 | 361 (instance name `usingTxt`) | 176, 6 | `variableName="_root._game.lives"`, initial "20" |
| 372 "INTEREST" | 5, 27 | 369 `interestText` | 52, 27 | script: `interestText.text = _root._game.interest + "%"` |
| 365 "LEVEL" | 117, 27 | 362 `lvlText` | 151, 27 | script: `lvlText.text = level + "/" + levels.length` |
| 366 "SCORE" | 5, 46 | 363 (instance name `needTxt`) | 37, 46 | `variableName="_root._game.score"` |
| 374 "BONUS" | 117, 46 | **371** (instance name `needTxt`) | 186, 46 | **`variableName="_root._game.ups"`**, initial "0" |

Plus two pulser clips (char 368): `pulserB` at 198,8 next to LIVES (flashes when `lives <= 5`)
and `pulserA` at 198,46 next to BONUS (flashes while `ups > 0`, together with
`_ui.sidebar.pulserA`) -- see `pulse()` in `DefineSprite_536` lines 150-171.

Why the earlier notes missed it: LIVES, SCORE and BONUS are Flash *variable-bound* text fields
(`DefineEditText.variableName`), updated by the player automatically; only BANK/INTEREST/LEVEL are
written from script (`DefineSprite_534/frame_1/PlaceObject2_375_28/... onClipEvent(enterFrame).as`).
Grepping scripts for `.text =` cannot find them; `-swf2xml` does. The instance names `usingTxt` /
`needTxt` are leftovers from the power-meter UI and are not used by script in this sprite.

The same three bindings exist in **v1.0** (`VectorDR.swf`: chars 355 lives, 357 score,
365 ups, static text 368 "BONUS"), so the economy note's claim "no such text field in v1.0/v1.2"
was wrong for both builds.

Counter semantics (confirmed): `ups = 0` in `setup()`; `ups++` in `kill()` when `C.Type == 6`;
`ups--` in the placer on successful placement of a Damage/Range Booster (`Type != "tower"`);
`ups -= 1` in the Interest Increase and Panic! handlers. Bonus items are unaffordable while
`ups <= 0` (cover overlay fades in, hand cursor off).

---

## 3. Tower panel 4x4 icon mapping -- confirmed

Sidebar sprite `DefineSprite_457`, frame 1. Column x = 9 / 48 / 89 / 127, row y = 31 / 65 / 101 /
137 (px inside the sidebar, icons are 25x25 at 1x). Each slot is the *tower's own sprite* placed
directly in the sidebar with clip actions (`rollOver` writes `_parent.towerName.text` and
`towerInfo.htmlText`; `release` spawns the `placer`). The level badge `l` ("1") inside each tower
sprite is hidden in the sidebar by `onClipEvent(load){ l._visible = false; }`.

| Slot | Char | Sprite / handler | Shop title (rollOver) | Icon look (matches owner's screenshot) |
|---|---|---|---|---|
| r1c1 | 108 | `tower_green` | GREEN LASER 1 | green, single node + beam |
| r1c2 | 101 | `tower_brown` | RED REFRACTOR ("Splash damage") | red star-burst |
| r1c3 | 123 | `tower_pink1` | PURPLE POWER 1 | purple box-in-box |
| r1c4 | 94 | `tower_blue` | BLUE RAYS 1 ("Slows multiple targets") | blue circle with one slash |
| r2c1 | 112 | `tower_green2` | GREEN LASER 2 ("Single bounce") | green, two nodes |
| r2c2 | 139 | `tower_swarm` | LITTLE RED SPAMMER ("Multiple random targets") | red nine dots |
| r2c3 | 127 | `tower_pink2` | PURPLE POWER 2 | purple, nested boxes |
| r2c4 | 90 | `tower_bash` | BLUE RAYS 2 ("Stuns target") | blue circle with X |
| r3c1 | 116 | `tower_green3` | GREEN LASER 3 ("Bounces twice") | green, three nodes |
| r3c2 | 135 | `tower_red` | RED ROCKETS ("Smart rockets") | red square-in-square |
| r3c3 | 131 | `tower_pink3` | PURPLE POWER 3 ("Slows target") | purple, deepest nesting |
| r3c4 | 409 | (no handlers, no cover) | -- | **empty grey square**; a placeholder shape, not a tower |
| r4c1 | 147 | `tower_buff1` -> `Type = "buffD"`, placed | DAMAGE BOOSTER, "Costs 1 bonus point", "+25% damage in range" | red flaming rocket / crosshair |
| r4c2 | 143 | `tower_buff2` -> `Type = "buffR"`, placed | RANGE BOOSTER, "Costs 1 bonus point", "+25% range in range" | green spiked star |
| r4c3 | 411 | click: `interest += 3; ups -= 1` (not placed) | INTEREST INCREASE, "Costs 1 bonus point" | gold **$** |
| r4c4 | 413 | click: `lives += 5; ups -= 1` (not placed) | PANIC!, "Costs 1 bonus point", "5 extra lives" | blue **atom** |

Owner's row-4 reading (Damage Booster, Range Booster, Interest Increase, Panic!, left to right) is
exactly right. The kickoff brief's earlier guesses ("atom = Red Refractor", "spiked green = Green
Laser 3", "rocket = Red Rockets") were wrong: atom = Panic!, spiked green = Range Booster, flaming
rocket = Damage Booster.

Notes:
- GREEN LASER 1 is placed twice at r1c1 (depth 22 and depth 74, both char 108, same position).
  The depth-22 copy has an older rollOver text ("Cost $" / "Damage:"); the depth-74 copy on top is
  the one you actually hit. Harmless authoring leftover.
- Every slot except r3c4 has a `c1` cover clip (char 454) over it that fades in when the item is
  unaffordable: towers when `bank < cost` (or the vestigial power check), bonus items when
  `ups <= 0`. With BONUS 0 the whole of row 4 is dimmed.
- Booster placement range: the placer is given `range = 80` for the radar circle, but `doBuffs()`
  applies the buff to towers < 100 px from the booster.

Exported sprites (4x zoom, frame 1, `l` badge visible because it is only hidden at runtime):
`docs/research/sprites-v1.2/r{row}c{col}-<name>.png`, plus `sidebar-composite.png` (whole
sidebar as rendered by FFDec; the red "X" boxes are FFDec's placeholder for the hidden `l` badge)
and `contact-sheet.png` (all 16 slots + 7 vectoid glyphs, labelled).

---

## 4. Vectoid type names and per-type data -- confirmed

`creepName(n)` in `DefineSprite_536` lines 217-244; glyphs are frames of `creepShapes`
(`DefineSprite_35`, frame = type number); speed/HP from `spawn()` lines 486-524.

| Type | Display name (Current & Next panel) | Glyph (`creepShapes` frame) | Speed | HP | Damage taken | Other |
|---|---|---|---|---|---|---|
| 1 | Red Shredder | red spiked star, spins 20 deg/frame and pulses size | 1 | baseHP | 150% from red towers, 50% from green | |
| 2 | Blue Spinner | blue 3-blade fan, spins 5-6 deg/frame | 1 | baseHP | 150% blue, 50% purple | |
| 3 | Green Flyer | green arrow/plane, wings flex | 1 | baseHP | 150% green, 50% red | |
| 4 | Yellow Sprinter | yellow triple chevron | **2** (only fast type) | baseHP | 100% | `maxSpeed = 2`, so slow effects recover toward 2 |
| 5 | Big Purple Box | purple square outline, breathes | 1 | baseHP | 150% purple, 50% blue | |
| 6 | (no name; never shown in the panel) | yellow ring with expanding/fading echo ring | 1 | **baseHP x 4** | 75% from every tower | awards `ups++` on kill; 14th creep on the last path every 5th wave (incl. wave 50) |
| 7 | Hard Grey `<yellow>+ Bonus</yellow>` | grey diamond outline, breathes | 1 | baseHP | 75% from every tower | the "+ Bonus" suffix advertises the type-6 cell that rides with the wave |
| 8 | shown as "???" as *next*, "All types" as *current* (wave 50 only) | mixed | mixed | baseHP | per type | `spawn()` assigns `int(cc/5)+1`, mapping 6 -> 7 |

Panel text format (`nowAndNext()`): `<name><br><hp> hp    $<bounty>`; the Next line shows
`baseWorth + 1`, Current shows `baseWorth`. The panel glyph is the same `creepShapes` clip
(`vNow`/`vNext` at sidebar 15,431 and 15,467). No other per-type text exists in v1.2 (the
"Vectoid Name / 500 hp" strings in char 455/456 are placeholder initial text).

Glyphs exported as `docs/research/sprites-v1.2/vectoid-{1..7}-<name>.png` (all seven, i.e. the six
named vectoids plus the bonus cell).

---

## 5. Interest display -- confirmed

- `setup()`: `interest = 3`. HUD: `interestText.text = interest + "%"` every frame.
- INTEREST INCREASE (`DefineSprite_457/frame_1/PlaceObject2_411_61/... on(release).as`):

```
if(_root._game.ups >= 1 && _root._game.Paused == 0) {
   _root._game.interest += 3;
   _root._game.ups -= 1;
}
```

So each purchase adds **3 percentage points** and decrements BONUS by 1; no cap. The owner's
screenshot (wave 6, INTEREST 6%, BONUS 0) is exactly one purchase: the wave-5 bonus cell was killed
(`ups` 0 -> 1), Interest Increase was bought (3% -> 6%, `ups` 1 -> 0). Interest is paid in `wave()`
on send for `level > 1` as `int(bank / 100 * interest)`, unchanged from the economy note.

The handler also cancels any in-progress placer (`towers.newt.placer.removeMovieClip()`), so
clicking $ while carrying a tower ghost drops the ghost.

---

## Sources

| Ref | What |
|---|---|
| C1 | `/tmp/vtd/ftd.swf` v1.2, scripts in `/tmp/vtd/out_ftd/scripts/` (JPEXS `-export script`) |
| C2 | `/tmp/vtd/xml_ftd/ftd.xml` (JPEXS `-swf2xml`), parsed with `/tmp/vtd/xml_ftd/dump.py` for placement matrices and `DefineEditText.variableName` |
| C3 | `/tmp/vtd/txt_ftd/*.txt` (JPEXS `-export text`) for static labels 364/365/366/372/373/374/435/440/443/446/447 |
| C4 | `/tmp/vtd/img_ftd/` (JPEXS `-export sprite -zoom 4`) for the icon and glyph PNGs |
| C5 | `/tmp/vtd/VectorDR.swf` v1.0 (`/tmp/vtd/out_VectorDR/scripts/`, `/tmp/vtd/v1.xml`, `/tmp/vtd/txt_VectorDR/`) for the v1.0 comparison only |

## Gaps

- Blue Rays 1/2 slow amounts and Purple Power 3 stop duration were not re-read here (outside the
  five questions); the towers note's values stand.
- Exact pixel art of the slot icons at 1x (25 px) was not compared against the owner's screenshot
  pixel-for-pixel; the shapes match by inspection at 4x.
- Whether the empty r3c4 slot (char 409) was ever intended for a 12th tower (the TDx/TD2 Rewinder
  occupies that position in later builds) is **unknown**; nothing in v1.2 references it.
