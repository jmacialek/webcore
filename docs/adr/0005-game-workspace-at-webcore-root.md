---
status: accepted
date: 2026-09-12
---
# The game is a pnpm workspace at the webcore repo root

Tower of Tribute 3D lives in this repo as a pnpm workspace (`packages/sim`,
`packages/protocol`, `apps/web`, later `apps/api`) alongside the static
dawnmud.com site (`index.html`, `proposal1..3`), which the workspace never
touches. The kickoff brief originally called for a separate repo; the owner
chose one repo for one CI pipeline and one deploy script. A nested workspace
under a subdirectory was rejected because CI, TypeScript project references,
and editor tooling all assume the repo root. The deploy script gains one
additive step that builds the client and syncs it to `/var/www/html/play/`.
