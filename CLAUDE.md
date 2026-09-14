# webcore

Two things live in this repo: the static dawnmud.com site (`index.html`,
`proposal1..3`, `scripts/deploy.sh`) and the game **Tower of Tribute 3D**
(code name vector3d), a pnpm workspace (`packages/*`, `apps/*`). The static
site and the proposals are frozen; the game never touches them (ADR 0005).

Read `CONTEXT.md` for vocabulary before naming anything. Decisions are in
`docs/adr/`; original-game facts are in `docs/research/`.

Toolchain: Node 24 (not the apt Node 22), pnpm. Run `pnpm check` (lint,
typecheck, test) from the repo root before committing.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on jmacialek/webcore via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
