---
status: accepted
date: 2026-09-12
---
# The sim runs at a fixed 120 Hz with seconds-based constants

The original game ran its logic per frame at 40 fps and several towers are
defined in frames (Green Laser damages every frame, Purple charges for 30
frames). We run the sim at a fixed 120 Hz timestep and express every constant
in seconds, converting the v1.2 values once in the Ruleset data. The render
loop is uncapped and interpolates between ticks. We rejected 40 Hz, which
would have transferred the numbers verbatim, because the owner wants higher
temporal resolution, and 60 Hz because 120 divides evenly into common display
rates.

## Consequences

- The Original fixture validates against the wave table and economy, not
  against a frame-exact trace of the Flash game.
- Command Logs are stamped in ticks, so server replay cost later scales with
  120 ticks per second.
- Hit points are floats: a Green Laser's 22 damage per original frame lands
  as 22/3 per tick, and the colour rule multiplies by 1.5, 0.5, and 0.75. Only
  Bank, Lives, Score, and Bonus Points stay integers. IEEE + - * / are
  correctly rounded on every engine, so this costs no determinism.
- Purple Powers charge on a linear 0 to 1 ramp over 0.75 s; the original's
  alpha 10 to 100 head start is not reproduced, and Purple Power 3's slow
  follows the same ramp.
