# @vector3d/sim

Deterministic, DOM-free simulation of a Tower of Tribute 3D Run (ADR 0002,
ADR 0003). Vocabulary is `CONTEXT.md` at the repo root.

## Public surface

Everything supported is exported from `src/index.ts`; nothing else under
`src/` is a supported import.

- `createRun({ ruleset, map, seed })` returns a `Run`: `apply(command)`
  validates and applies a `Command` at the current `tick`, `step()` advances
  one fixed 1/120 s tick and returns the `SimEvent`s it produced,
  `snapshot()` reads the state, `digest()` hashes it, `log()` and
  `serialise()` record the Run for replay.
- `replayRun(serialised, resolver?)` replays a `SerialisedRun` and returns its
  final digest; `defaultResolver` resolves the built-in Rulesets and Maps.
- Rulesets: `original` (v1.2 numbers) and `classic` (ADR 0001), `getRuleset(id)`,
  `getTowerSpec(ruleset, kind)`, `waveStats`, `waveTable`, `waveComposition`.
- Maps: `switchback`, `getMap(id)`, `parseMap(text)`.
- Types: `Command`, `Snapshot`, `SimEvent`, `RejectReason`, `Ruleset`,
  `GameMap`, and the rest of `src/types.ts`.

Tests live in `test/` and import only from `../src/index.js`.

## Balancing harness

`harness/` is a developer tool, not public surface. It plays a build order
headlessly like an eager player without Auto: it Sends every Wave the
instant `canSend` holds, applies that Wave's Commands right after the Send,
and steps until the Run ends or a tick cap (30 sim minutes by default).

```sh
pnpm --filter @vector3d/sim harness green-laser-rush
pnpm --filter @vector3d/sim harness frost-rockets --ruleset classic --seed 1
pnpm --filter @vector3d/sim harness red-rockets --map switchback --ticks 36000
```

It prints one row per Wave: the second the Wave was Sent, Vectoids Leaked
between that Send and the next, Bank and Score at the moment of the next
Send (or at the end), and seconds from the Send until the field was clear
(`-` when the next Send came first). Rejected Commands are printed as
warnings with their reason; the run is never aborted. The last line gives
the outcome, final Score, Lives, and Bank.

A build order (`harness/build-orders/*.ts`) is a list of Wave-relative
steps: `{ wave, commands }` means "as soon as Wave `wave` has been Sent,
apply these Commands in order"; Wave 0 means before the first Send. The
commands are the public `Command` type without `tick`. Tower ids are the
sim's own (1, 2, ... in placement order), so a step may refer to a Tower
placed earlier. Register a new build order in `harness/build-orders/index.ts`.

Checked-in examples:

- `green-laser-rush` (Original): Green Lasers along the first corner.
- `red-rockets` (Original): Red Refractors early, Red Rockets by Wave 15.
- `frost-rockets` (Classic): the `red-rockets` economy with Blue Frost
  Rockets as the Tier 3, for comparing the two at equal spend (M1-18).

From a test or script, `runHarness(buildOrder, { ruleset, seed, map, tickCap })`
returns the same data as a `HarnessResult`, and `formatReport(result)` gives
the text lines.

The CLI runs straight from source on Node 24's type stripping;
`harness/loader.ts` retries `.js` specifiers as `.ts` so the harness can
import `../src/index.js` exactly as a client would.
