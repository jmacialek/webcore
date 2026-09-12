# Tower of Tribute 3D (code name: vector3d)

A web-native tribute to Vector TD (David Scott, 2007), built in this repo
alongside the static dawnmud.com site. One context: the game itself. Terms
marked *pending* are still open in the design interview.

## Language

### Time and progression

**Wave**:
One of the fifty numbered groups of Vectoids a Map sends, counted 1 to 50.
_Avoid_: Level, round, stage

**Bonus Wave**:
Every fifth Wave. It carries Hard Grey Vectoids and exactly one Bonus Cell.
_Avoid_: Hard wave, boss wave

**Send**:
The act of releasing the next Wave, by the player or by Auto. Interest is paid
at the moment of a Send.
_Avoid_: Start wave, call wave, early send

**Auto**:
A player toggle that Sends the next Wave the instant the current one is cleared.

### Vectoids

**Vectoid**:
An enemy that walks a Lane. Each has a colour type that sets how much damage
it takes from each Tower Tree. The five coloured types are Red Shredder, Blue
Spinner, Green Flyer, Yellow Sprinter (the only fast one), and Big Purple Box.
_Avoid_: Creep, enemy, mob, unit

**Hard Grey**:
A grey Vectoid type that takes reduced damage from every Tower. Appears on
Bonus Waves. It is not the Bonus Cell.

**Bonus Cell**:
A single hidden Vectoid at the end of each Bonus Wave with four times the
Wave's hit points. Killing it awards one Bonus Point; leaking it awards
nothing.
_Avoid_: Power cell, bonus vectoid, hard vectoid

**Leak**:
A Vectoid reaching the end of its Lane. It costs one Life and the Vectoid
restarts at the Lane's Entry.
_Avoid_: Escape, breach

**Life**:
One unit of the player's remaining tolerance for Leaks. The Run ends at zero.
_Avoid_: HP, health (reserved for Vectoids)

### Towers

**Tower**:
A placed defensive object occupying one Cell.

**Tree**:
One of the four colour families of Towers: Green, Red, Purple, Blue.
_Avoid_: Class, category, colour (on its own)

**Tier**:
A Tower's position within its Tree, 1 to 3 (Green Laser 1, 2, 3). Every Tree
has three Tiers; Blue Frost Rockets, the Blue Tier 3, is new to this tribute.

**Blue Frost Rockets**:
The new Blue Tier 3: long-range rockets whose impact slows every Vectoid near
it, with player-selectable Targeting Mode. Numbers set by a balancing
prototype.
_Avoid_: Blue 3, ice rockets, frost tower
_Avoid_: Mark, level, model

**Rank**:
The upgrade step of a placed Tower, 1 to 10. Each Rank costs a flat fraction of
base cost and raises damage and Range.
_Avoid_: Level, upgrade level

**Range**:
The radius around a Tower within which it can target Vectoids.

**Targeting Mode**:
The rule a Tower uses to pick a Vectoid in Range. Player-selectable modes are
Close (nearest), Hard (highest current hit points), and Weak (lowest current
hit points). Blue Rays are fixed to Fastest and the Spammer to Random. Ties go
to the earliest-spawned Vectoid.
_Avoid_: Priority, focus

**Target Lock**:
A per-Tower toggle: when on, the Tower keeps its current target until it dies
or leaves Range; when off, it re-selects before every shot.
_Avoid_: Focus, sticky targeting

**Max Upgrade** (*pending*: behaviour when the Bank cannot cover all Ranks):
A single action that raises a Tower to Rank 10 in one click.
_Avoid_: Auto-upgrade, upgrade all

**Sell**:
Removing a Tower for a refund of a fixed fraction of everything spent on it.

### Bonus items

**Bonus Point**:
The currency earned by killing a Bonus Cell, at most one per Bonus Wave.
_Avoid_: Bonus, ups, points

**Bonus Item**:
Anything bought with a Bonus Point: the two Boosters plus Interest Increase
and Panic.

**Booster**:
A Bonus Item placed on a Cell like a Tower. Damage Booster and Range Booster
each raise that stat for every Tower within their radius, and stack additively.
_Avoid_: Buff tower, support tower, aura

**Interest Increase**:
An instant Bonus Item that permanently raises the Interest rate.

**Panic**:
An instant Bonus Item that grants extra Lives.

### Economy and score

**Bank**:
The player's current money.
_Avoid_: Cash, gold, funds

**Interest**:
A percentage of the whole Bank paid into the Bank at each Send after the first.

**Bounty**:
The Bank reward for killing one Vectoid. Rises with the Wave number.
_Avoid_: Reward, worth, kill value

**Score**:
The running value the sim computes during a Run. Kills and Interest raise it;
Leaks lower it, never below zero.

**Verified Score**:
A Score recomputed by replaying a submitted Run on the server. Only Verified
Scores rank on a public Board. Out of scope until accounts exist.

### Map and field

**Grid**:
The 22 by 18 field of Cells that a Map occupies.

**Cell**:
One square of the Grid. A Cell is either part of a Corridor or buildable.
_Avoid_: Tile, square, block (see Platform)

**Map**:
A named Grid layout with its Corridor, Entries, Exits, and difficulty group.

**Corridor**:
The unbuildable strip of Cells that Vectoids travel through, normally two Cells
wide. It contains two Lanes.
_Avoid_: Path (ambiguous with Lane), road, track

**Lane**:
One of the two waypoint polylines inside a Corridor that a Vectoid follows
single file. Lanes may cross, split, or converge.
_Avoid_: Path, route

**Entry**:
The point where a Lane enters the Grid. A Map may have more than one.
_Avoid_: Spawn, start

**Exit**:
The point where a Lane leaves the Grid and a Leak is counted.
_Avoid_: Goal, end, base

### Presentation

**Camera Mode**:
One of the two ways the field is viewed: Classic or Tower View.

**Classic**:
The default Camera Mode: top-down, reads like the 2007 game.

**Tower View**:
The 3D Camera Mode entered from a selected Tower. The camera sweeps to that
Tower's vantage, the whole field stays visible, and the player can orbit it.
Selecting another Tower re-sweeps to it.
_Avoid_: Tactical, 3D mode, first person

**Platform**:
The raised block beneath every buildable Cell in Tower View. Towers sit on top
of it.
_Avoid_: Base, tile, block

**Channel**:
The Corridor as rendered in Tower View: a trench between transparent walls
whose top edges glow white. Vectoids travel at Platform height inside it.

### Runs and rules

**Run**:
One complete play of a Map under a Ruleset: its Seed plus its Command Log.
_Avoid_: Game, session, match, playthrough

**Seed**:
The number that fixes every random choice the sim makes in a Run.

**Command Log**:
The ordered list of player actions in a Run. Replaying it with the Seed
reproduces the Run exactly.
_Avoid_: Input log, history, actions

**Ruleset**:
A named, versioned set of numbers and rules the sim plays by. Classic is the
default Ruleset: Vector TD v1.2 plus each recorded improvement. Original is
the pure v1.2 Ruleset, kept only as a sim test fixture, never selectable.

**Endless**:
The Ruleset that continues past Wave 50 with no end. Its Score is kept apart
from Classic.
_Avoid_: Survival, infinite, wave 51+
_Avoid_: Mode, difficulty (a difficulty group belongs to a Map)

**Board**:
A ranked list of Verified Scores. Out of scope until accounts exist.
_Avoid_: Leaderboard, high scores, ranking
