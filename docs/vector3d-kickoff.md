# Vector 3D Ultra Edition: project kickoff brief

Ingest this file with `/grill-with-docs`. It is the opening statement of a
design interview, not a spec. Everything under "Decided" is settled by the
owner and must not be re-litigated. Everything under "Recommended defaults" is
the engineer's proposed answer and is fair game for grilling. Everything under
"Open frontier" is the first round of questions the interview should ask.

Working title: **Vector 3D Ultra Edition** (the `<title>` of the design
template). The name is a frontier question.

---

## 0. Bootstrap before the interview

The interview writes `CONTEXT.md` and `docs/adr/` into the repo it runs in.
Run it inside the new project's repo, not inside `webcore`. `webcore` stays
the deploy repo for www.dawnmud.com; proposal1/2/3 there are frozen and must
not be touched.

```sh
mkdir -p ~/repos/vector3d && cd ~/repos/vector3d && git init -b main
mkdir -p docs/design-reference
cp ~/repos/webcore/index.html            docs/design-reference/hud-template.html
cp ~/repos/webcore/docs/vector3d-kickoff.md docs/kickoff.md
cp ~/repos/webcore/docs/webcore-inventory.md docs/design-reference/webcore-inventory.md
git add -A && git commit -m "chore: seed repo with kickoff brief and HUD design template"
```

Then, in that directory, in a fresh session:

1. `/setup-matt-pocock-skills` (accept GitHub issues once a remote exists,
   otherwise local markdown under `.scratch/`; accept default triage labels;
   single context).
2. `/grill-with-docs docs/kickoff.md`

The interview must dispatch research sub-agents for facts (section 6) and
never ask the owner for anything that can be looked up.

---

## 1. Mission

Build a fully modernized, significantly expanded tribute to **Vector TD**
(David Scott, Candystand, 2007, Flash tower defense). Faithful in feel and
economy, rebuilt as a web-native game with a 3D presentation layer, a
persistent leaderboard backed by TimescaleDB, and secure user accounts.

Quality bar is A+ across the board: every icon designed as part of one
coherent set, every UI element deliberate, engine deterministic and tested,
backend hardened, deploy reproducible. Nothing shipped "for now".

The build follows the Matt Pocock engineering method end to end:

| Phase | Skill | Output |
| --- | --- | --- |
| Design interview | `/grill-with-docs` | `CONTEXT.md` glossary, ADRs, shared understanding |
| Research gaps | `research` (background agents) | cited notes under `docs/research/` |
| Design questions with a UI or state answer | `prototype` | throwaway HTML, decisions folded into ADRs |
| Spec | `/to-spec` | one spec per milestone on the tracker |
| Breakdown | `/to-tickets` | tracer-bullet tickets with blocking edges |
| Build | `/implement` driving `tdd` at agreed seams | code, tests, `/code-review` before each commit |
| Big-picture routing | `/wayfinder` | only if a milestone outgrows one session |

Orchestration: the owner will run milestones with sub-agents in parallel.
Every ticket must therefore name its seam, its test boundary, and its
blocking edges so independent agents cannot collide.

---

## 2. Source material (read before asking anything)

- **`docs/design-reference/hud-template.html`**: the HUD design template.
  Single dependency-free file. It is the visual contract: palette in the CSS
  custom properties (`--bg-space`, `--purple-base`, `--cyan-base`,
  `--pink-base`, `--emerald-base`, `--amber-base`), fonts Rajdhani /
  JetBrains Mono / Space Grotesk, glass panels, header strips, stat tiles,
  tower cards with tier and lock badges, tower inspector, targeting pills,
  current-and-next wave panel, 18x22 auto-scaling vector grid with hover
  coordinates, 260-star canvas starfield with mouse links, Web Audio beeps.
  It may be modified for new features but it is the starting point, not a
  suggestion.
- **Original game screenshot facts** (Switchback map, v1.2): top bar with
  Send the Vectoids, Auto checkbox, Bank, Interest 3%, Score, Lives, Level
  n/50, Bonus. Tower matrix 4 columns by 4 rows: green, red, purple, blue
  trees in the first three rows, four specials in the fourth (rocket, spiked
  green, dollar, atom). Inspector: Dmg, Range, Level, special text, "After
  upgrade" delta, Upgrade $, Close / Hard / Weak targeting, Target Locking
  on/off, Sell $. Current & Next panel with vectoid glyph, name, hp, bounty,
  "+ Bonus" tag. Black path cut through a cyan grid, green entry tile, red exit
  tile, white range circle on the selected tower. Vectoids are wireframe
  glyphs with green health bars above them.
- **`docs/design-reference/webcore-inventory.md`**: the production host.
  Proxmox LXC 122, Ubuntu 26.04, 16 vCPU, 32 GiB, nginx 1.28 on 80/443,
  cloudflared tunnel, Let's Encrypt wildcard for `*.dawnmud.com`, Node 22,
  Python 3.14, no Docker yet, UFW off with filtering upstream.
- **Template tower data** (already in the HUD, treat as placeholder numbers):
  costs 75 / 100 / 125 / 150 / 180 / 240 / 280 / 320, specials "Single Target
  DPS", "Splash damage", "40% Kinetic Slow", "+30% Range Aura", "Multi-Beam
  Tracking", "Submunition Cluster", "Vortex Pull", "+50% Critical Chance".
  Sell is 70% of cost in the template.

---

## 3. Decided (do not re-open)

1. Tribute to Vector TD, expanded significantly. Not a pixel clone.
2. The HUD template is the design base. Icons are redone as a new coherent set.
3. A 3D feature is in scope for v1 (what "3D" means is a frontier question).
4. Leaderboard / score board with persistent storage.
5. Database is PostgreSQL with the TimescaleDB extension.
6. User accounts with a secure credential store.
7. Engineering method is the Matt Pocock skill set as tabled above, with
   sub-agent orchestration per ticket.
8. Every UI element and icon is designed with care. No placeholder art ships.
9. `webcore` repo and proposal1/2/3 are untouched by this project.

---

## 4. Recommended defaults (grill these)

### 4.1 Architecture shape

Three deep modules with one seam each. Fewer seams beat more.

1. **`sim`**: pure TypeScript, zero DOM, deterministic. Fixed timestep
   (recommend 30 Hz sim, render interpolates). Seeded PRNG. Input is a
   command log (`placeTower`, `upgrade`, `sell`, `setTargeting`, `sendWave`,
   `toggleAuto`); output is a snapshot per tick plus an event stream
   (`vectoidSpawned`, `vectoidKilled`, `leaked`, `waveCleared`, `interestPaid`).
   Same code runs in the browser and on the server. This is the primary test
   seam: feed commands and a seed, assert on snapshots and events.
2. **`presentation`**: Three.js renderer (WebGL2) for the map, vectoids,
   towers, projectiles, effects; DOM/CSS from the HUD template for panels.
   Two camera modes: **Classic** (orthographic top-down, reads exactly like
   the 2007 game) and **Tactical** (perspective, tilt and orbit, extruded
   path, volumetric glow). Classic is the default so the tribute is honest;
   Tactical is the 3D feature. Test seam: render a snapshot to a scene graph
   and assert on node counts and transforms, plus Playwright screenshot
   baselines.
3. **`platform`**: Node 22 + Fastify + TypeScript HTTP API, Postgres via
   `postgres.js` or Drizzle, Zod at the boundary. Owns accounts, sessions,
   run submission, score verification, leaderboards. Test seam: HTTP against
   a real Timescale container (Testcontainers), no mocks of the database.

Shared package `@vector3d/sim` consumed by both client and server.

### 4.2 Anti-cheat by construction

A score is never trusted from the client. A **Run** is submitted as
`{ seed, mapId, ruleset version, command log }`. The server replays it through
the same `sim` and records the score it computes. Mismatch is rejected and
logged. This gives replays, ghost runs, and shareable run links for free and
is the single most important architectural decision to lock in early.

### 4.3 Frontend stack

TypeScript strict, Vite, Vitest, Playwright. No UI framework for the HUD;
the template is already DOM + CSS and a small typed store with subscriptions
is enough. Three.js for 3D. Self-host the three fonts as latin WOFF2 subsets
(the way `proposal2` did) so the page makes zero third-party requests. Strict
CSP. Performance budget: 60 fps on an integrated GPU at 1080p in Classic,
initial JS under 350 KB gzip, first interaction under 2 s on a mid laptop.

### 4.4 Data model (Timescale)

Relational tables: `users`, `credentials`, `sessions`, `maps`, `rulesets`,
`runs`, `run_scores`. Hypertables: `run_events` (every sim event with tick
timestamp, keyed by run) and `client_metrics` (fps, frame time, dropped
ticks). Continuous aggregates produce the leaderboards: all-time, weekly,
daily, per map, per ruleset version. Retention policy on raw events
(recommend 90 days) with compressed chunks after 7 days; scores are kept
forever. Leaderboard identity: display name chosen at signup, unique,
profanity-checked, changeable with cooldown.

### 4.5 Accounts and security

Email + password. Argon2id with tuned parameters. Server-side sessions in
Postgres with rotating opaque tokens in an `HttpOnly; Secure; SameSite=Lax`
cookie. Email verification before a score appears on public boards. Rate
limits per IP and per account on login, signup, and run submission. Passkeys
(WebAuthn) as a second milestone, not v1. No OAuth in v1. Password reset via
signed single-use tokens, mail sent through the host's Postfix or a
transactional provider (frontier question). Audit log table for auth events.
Secrets from environment files never committed; `.env.example` committed.

### 4.6 Icon and art system

One SVG system, 24-unit grid, 1.75 stroke, round joins, all icons built
from the same primitive vocabulary (node, edge, ring, chevron, lattice). Four
tower trees each get a distinct silhouette family; tiers 1 to 3 add
complexity within the family; the four specials break the family rule
deliberately. Vectoid glyphs follow the same rules but are open wireframes.
Each icon has a 2D SVG and a matching 3D mesh or extruded profile so the HUD
card and the on-map object are the same shape. Deliver as a sprite sheet
plus individual files, with a contact-sheet HTML page for review.
Colour tokens come only from the template's custom properties.

### 4.7 Game design expansions (beyond the original)

- Multiple maps, starting with Switchback, then at least two new ones with
  distinct path topology (a crossing path and a split path).
- Difficulty tiers that scale hp and bounty; ruleset versioned so old scores
  stay comparable.
- Daily seeded challenge: everyone gets the same seed and map; separate board.
- Endless mode after wave 50 with a separate board.
- Replay viewer and share links (falls out of 4.2).
- Achievements as a later milestone.
- Full keyboard control and screen-reader-readable HUD state.

### 4.8 Deployment

Runs on `webcore`. Postgres + TimescaleDB in Docker Compose on the host
(install Docker CE, persistent volume on the LXC disk, nightly `pg_dump` to
a location outside the container). Node API as a systemd service on
localhost. nginx serves the static client and proxies `/api` to the service
under a new hostname `play.dawnmud.com` on the existing wildcard cert and
cloudflared tunnel. Deploy script in the new repo, same additive philosophy
as `webcore/scripts/deploy.sh`. GitHub Actions for lint, test, and build on
every push; deploy is manual.

---

## 5. Domain vocabulary seeds

The interview should sharpen and record these in `CONTEXT.md`. Start here;
do not accept a fuzzy term.

Vectoid, Wave, Level (1..50), Tower, Tree (green / red / purple / blue),
Tier, Special tower, Refractor, Range, Targeting mode (Close / Hard / Weak),
Target lock, Bank, Interest, Bounty, Bonus wave, Hard Grey, Leak, Life,
Score, Run, Seed, Command log, Ruleset, Map, Path, Entry, Exit, Cell, Grid,
Camera mode (Classic / Tactical), Board (leaderboard), Display name,
Session, Credential.

Likely collisions to settle on round one: "Level" (wave number vs tower
upgrade level; the original uses both), "Score" (in-run running score vs
submitted verified score), "Bonus" (bonus wave vs score bonus).

---

## 6. Facts to research before deciding (dispatch sub-agents, do not ask)

The original's numbers are poorly documented online, which is why a lot
of this design is missing from the web. Each of these becomes a
`docs/research/*.md` file with citations, and where the sources are silent
the interview proposes a value and records it as a ruleset decision.

1. Vector TD tower roster: exact names, costs, damage, range, upgrade steps,
   and the colour-resistance rule (which colours damage which vectoids).
2. Wave table: hp per level, bounty per level, speed classes, boss and bonus
   wave cadence, Hard Grey behaviour.
3. Economy: interest formula and when it is paid, sell refund fraction,
   starting bank and lives, score formula.
4. Map list and path layouts for Vector TD and Vector TD 2.
5. Targeting semantics: what Close, Hard, Weak and Target Locking did
   exactly.
6. TimescaleDB current version on Postgres 17, continuous aggregate and
   compression policy syntax, Docker image tag.
7. Argon2id parameter guidance current as of 2026 and Fastify session and
   rate-limit plugin state.
8. Three.js current release and WebGPU renderer maturity, to decide WebGL2
   versus WebGPU with fallback.

---

## 7. Open frontier (first round of the interview)

Ask these first, with the recommendation shown. Each unblocks a branch.

1. **Name.** Keep "Vector 3D Ultra Edition" or pick a fresh name? Recommend a
   fresh short name that does not use the "Vector TD" mark, keep the working
   title as the code name.
2. **What "3D" means.** Recommend Classic + Tactical camera modes over a
   single 3D-only view, so the tribute stays legible.
3. **Fidelity.** Recreate the original ruleset as the default ruleset, then
   add expansions as separate rulesets, or design one new ruleset inspired
   by it? Recommend the former: a "Classic" ruleset that matches the
   original as closely as research allows, so veterans can compare scores.
4. **Repo layout.** Single repo with `packages/sim`, `apps/web`, `apps/api`
   (pnpm workspaces), or three repos? Recommend the single repo.
5. **Accounts in v1.** Email + password only, or passkeys from day one?
   Recommend email + password v1, passkeys milestone 2.
6. **Mail.** Host Postfix or a transactional provider for verification and
   reset mail? Recommend a provider; Postfix on a residential-adjacent LXC
   will land in spam.
7. **Hostname.** `play.dawnmud.com` or the root site? Recommend `play.` and
   leave the root HUD page as the marketing front door.
8. **Database placement.** Docker on `webcore`, or a separate LXC for the
   database? Recommend Docker on `webcore` for v1 with backups off-box.
9. **Public boards and privacy.** Show display names only, never email;
   unverified accounts play but do not rank. Confirm.
10. **Anti-cheat depth.** Server replay verification only, or also client
    attestation and timing checks? Recommend replay verification only in v1
    plus obvious-outlier flagging.
11. **Sound.** Keep procedural Web Audio (no audio assets) or add designed
    samples? Recommend procedural synth, upgraded to a small designed
    instrument set, because it keeps the zero-asset-request property.
12. **Milestone order.** Recommend: M1 sim engine with Classic ruleset and
    headless tests; M2 Classic renderer + HUD wired to sim (playable);
    M3 icon set and art pass; M4 accounts + run submission + boards;
    M5 Tactical 3D camera and effects; M6 new maps, daily seed, endless;
    M7 deploy to play.dawnmud.com. Confirm or reorder.

---

## 8. Definition of done (applies to every ticket)

- Behaviour tested through the module's seam, not its internals.
- `sim` changes come with a replay fixture whose score is asserted.
- Any UI change ships with a Playwright screenshot baseline update and a
  keyboard-only walkthrough.
- Any schema change ships with a migration, a rollback, and a Timescale
  policy review.
- Any auth or API change ships with a rate-limit and input-validation test.
- Lint, typecheck, unit, integration, and e2e all green in CI.
- `/code-review` run before commit; findings resolved or recorded.
- `CONTEXT.md` updated if a term was introduced; ADR written only if the
  decision is hard to reverse, surprising, and a real trade-off.

---

## 9. Out of scope for v1

Mobile touch layout, multiplayer or co-op, user-generated maps, OAuth
sign-in, native wrappers, monetisation, localisation beyond English.
