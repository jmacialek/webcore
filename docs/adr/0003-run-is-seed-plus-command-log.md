---
status: accepted
date: 2026-09-12
---
# A Run is a Seed plus a Command Log, replayed for verification

Every play is modelled as a Run: a Seed, a Map, a Ruleset version, and the
ordered Command Log of player actions. Replaying the log through the same sim
reproduces the Run and its Score exactly. We keep this in v1 even though there
is no server yet, because it is the sim's primary test seam, it gives local
replays for free, and it lets Phase 2 verify submitted scores by replay
instead of trusting the client. The alternative, a mutable game state driven
directly by UI events, would have been simpler to write and impossible to
verify later.

## Consequences

- Anything that affects the sim must be a command; presentation controls such
  as game speed and camera are not commands.
- Randomness in the sim must come from the seeded generator only.
