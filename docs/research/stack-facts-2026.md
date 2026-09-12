# Stack facts, September 2026

Research snapshot for the Vector 3D web-game project. All facts were checked on
**2026-09-12** against primary sources (official docs, GitHub release APIs,
Docker Hub, npm registry, OWASP, RFC Editor, browser vendor release notes).
Each fact is tagged:

- **confirmed** = read directly from a primary source (page, GitHub API, npm registry, or source code).
- **single-source** = only one primary page states it, or it was inferred from a listing rather than an explicit statement.

## Summary

| Component | Current | Notes |
|---|---|---|
| TimescaleDB | **2.30.0** (2026-09-08) | Supports PG **16, 17, 18**; PG 15 dropped in 2.29.0. |
| TimescaleDB Docker | `timescale/timescaledb:latest-pg18` / `2.30.0-pg18`; `timescale/timescaledb-ha:pg18` | Default tags include Timescale-License features; `-oss` tags are Apache-only. |
| Argon2id (OWASP) | m=19 MiB, t=2, p=1 minimum | RFC 9106: t=1/m=2 GiB/p=4 or t=3/m=64 MiB/p=4. |
| Node.js | **24 Active LTS** (Krypton), 22 Maintenance LTS, 26 Current | `crypto.argon2()` built in since **v24.7.0**, marked stable in v24.19.0. |
| `argon2` npm | 0.45.1 (2026-07-21) | Native addon; now optional given Node 24 built-in. |
| Fastify | **5.12.4** (2026-09-11); 6.0.0-alpha.3 | v6 alpha bumps minimum Node to 24. |
| Fastify plugins | cookie 11.1.2, session 11.1.2, secure-session 8.3.0, rate-limit 11.2.0 | All target Fastify 5. |
| fastify-type-provider-zod | 7.0.0 (2026-06-24) | Requires Zod >= 4.1.5, Fastify ^5.5.0. |
| Hono | 4.13.7 (2026-09-04), `@hono/node-server` 2.1.1 (Node >= 20) | No first-party session/rate-limit. |
| Three.js | **r186** / npm 0.186.0 (2026-09-08) | `WebGPURenderer` auto-falls back to WebGL 2; +255 KB minified vs WebGLRenderer. |
| WebGPU browsers | Chrome 113+, Safari 26+, Firefox 141+ (Windows) / 145-147 (macOS Apple Silicon); Firefox Linux not shipped | caniuse global support 87.35 %. |
| Drizzle ORM | stable **0.45.2** (2026-03-27); **1.0.0-rc.4** (2026-06-27) | drizzle-kit stable 0.31.10. No hypertable support; use custom SQL migrations. |
| postgres.js | 3.4.9 (2026-04-05) | Supported Drizzle driver via `drizzle-orm/postgres-js`. |

Surprises worth knowing:

1. Node 24 ships a built-in `crypto.argon2()` / `argon2Sync()` (added v24.7.0, stable since v24.19.0). The `argon2` npm native addon is no longer required on Node 24+.
2. TimescaleDB renamed compression to "columnstore"/"hypercore" in **2.18.0** (`timescaledb.compress` and `add_compression_policy()` deprecated) and added `CREATE TABLE ... WITH (tsdb.hypertable ...)` in **2.20.0**; `create_hypertable()` is kept for backward compatibility.
3. Every Timescale feature this project wants beyond plain hypertables (continuous aggregates, columnstore/compression, retention, job policies) lives in the Timescale-License `tsl/` tree. The default Docker tags include it; `-oss` tags strip it.
4. Fastify 6 is in alpha (alpha.0 to alpha.3, Aug-Sep 2026) and its `main` branch is already 6.0.0-alpha; production remains v5.
5. Drizzle 1.0 is still RC after 5 months of RCs; `latest` on npm is 0.45.2. Timescale DDL is an open feature request (#2962 since 2024-09, #4621 since 2025-06).
6. Firefox has still not enabled WebGPU on Linux in release builds (as of caniuse and Firefox 141-147 release notes).

---

## 1. TimescaleDB

### Release and PostgreSQL support

- Latest release **2.30.0**, published **2026-09-08** (GitHub API `published_at: 2026-09-08T10:54:46Z`). Previous: 2.29.2 (2026-08-18), 2.29.1 (2026-08-04), 2.29.0 (2026-07-28), 2.28.3 (2026-07-16). **confirmed**
- 2.29.0 release notes: "TimescaleDB 2.29.0 removes support for PostgreSQL 15. This release supports PostgreSQL 16, 17, and 18." **confirmed**
- 2.30.0 release notes do not restate the PG matrix; Docker Hub publishes `2.30.0-pg16`, `2.30.0-pg17`, `2.30.0-pg18` (plus `-oss` variants), so PG 16/17/18 remain the supported set. **confirmed** (via Docker Hub tag list)
- 2.30.0 headline: "performance improvements and bug fixes since the 2.29.2 release"; introduces `DeferredChunkAppend` for faster `LIMIT` / last-point queries. **single-source** (release page)
- Docs warn against PostgreSQL 17.1 / 16.5 / 15.9 / 14.14 / 13.17 / 12.21 (ABI break); use 17.2, 16.6 or higher. **confirmed**

### Docker images

Two official images (docs, "Install TimescaleDB from a Docker container"): **confirmed**

| Image | Base | Contents | Example tag |
|---|---|---|---|
| `timescale/timescaledb-ha` | Ubuntu | "offers the most complete TimescaleDB experience. It uses Ubuntu, includes TimescaleDB Toolkit, and support for PostGIS and Patroni." | `timescale/timescaledb-ha:pg18` |
| `timescale/timescaledb` | Alpine | "light-weight ... uses Alpine and does not contain TimescaleDB Toolkit or support for PostGIS and Patroni." | `timescale/timescaledb:latest-pg18` |

Tag conventions:

- `timescale/timescaledb`: `latest-pg<MAJOR>` (e.g. `latest-pg18`, `latest-pg17`, `latest-pg16`) and pinned `<TS_VERSION>-pg<MAJOR>` (e.g. `2.30.0-pg18`). Append `-oss` for the Apache-only build (`latest-pg18-oss`, `2.30.0-pg18-oss`). There is deliberately **no plain `latest` tag** (to avoid silent PG major upgrades). **confirmed** (Docker Hub README + tag list)
- `timescale/timescaledb-ha`: `pg<MAJOR>`, `pg<MAJOR>-ts<TS_MINOR>` (e.g. `pg18-ts2.30`), `pg<MAJOR>.<MINOR>-ts<TS_FULL>` (e.g. `pg18.6-ts2.30.0`), `-all` variants bundling older TimescaleDB versions, and `-oss` variants for each. Multi-arch (`-arm64` tags also present). **confirmed** (timescaledb-docker-ha README + Docker Hub tag list, pushed 2026-09-09)
- `timescaledb-ha` docs example: `-v <folder>:/pgdata -e PGDATA=/pgdata` (data directory is configurable via `PGDATA`). **confirmed**
- Nightly dev builds: `timescaledev/timescaledb:nightly-pg18` "(for PG 16, 17 and 18, on linux/amd64 and linux/arm64)". **confirmed**

Recommended pin for this project: `timescale/timescaledb:2.30.0-pg18` (small image, all Community features) or `timescale/timescaledb-ha:pg18.6-ts2.30.0` if Toolkit/PostGIS are wanted.

### Licensing: which features are in the image

- TimescaleDB ships two editions (docs, "TimescaleDB editions"): **confirmed**
  - **Apache 2 Edition**: Apache-2.0, "anyone can take this code and offer it as a service."
  - **Community Edition**: "the advanced, best, and most feature complete version of TimescaleDB, available under the terms of the Tiger Data License (TSL)." "Completely free if you manage your own service." "You cannot sell TimescaleDB Community Edition as a service."
- Feature matrix (docs): hypertables in both; **continuous aggregates, columnstore/compression, retention policies, job scheduling: Community only**. **confirmed**
- Source confirmation: the `tsl/` tree (governed by `tsl/LICENSE-TIMESCALE`, "TIMESCALE LICENSE AGREEMENT") contains `bgw_policy/` (`compression_api.c`, `continuous_aggregate_api.c`, `retention_api.c`, `job_api.c`, ...), `compression/`, `continuous_aggs/`. **confirmed**
- Docker build: the `timescaledb-docker` Makefile builds `-oss` tags with `--build-arg OSS_ONLY=" -DAPACHE_ONLY=1"` and the Dockerfile then removes `timescaledb-tsl-*.so`. Therefore **default (non-`-oss`) tags contain the Community/TSL features**; `-oss` tags do not. **confirmed** (Makefile + Dockerfile)
- The `timescaledb-ha` README likewise: "if you only want to exclude Timescale License code you can use ... `make build-oss`". **confirmed**

### Renames (2.18.0 to 2.20.0)

- **2.18.0**: "hypercore" = "hybrid row-columnar storage engine"; rowstore (uncompressed) / columnstore (compressed). `ALTER TABLE ... SET (timescaledb.enable_columnstore, ...)` replaces `timescaledb.compress`; `add_columnstore_policy()` "replaces `add_compression_policy()`, deprecated in 2.18.0". **confirmed**
- **2.20.0**: `CREATE TABLE ... WITH (tsdb.hypertable, ...)` introduced ("Since 2.20.0"). `create_hypertable()` remains "for backward compatibility"; docs say "Use `CREATE TABLE` for new hypertables." **confirmed**
- Source (`src/with_clause/create_table_with_clause.c` at tag 2.30.0) accepts these aliases: `tsdb.hypertable`; `tsdb.columnstore` | `tsdb.enable_columnstore` | `tsdb.compress` (default true); `tsdb.partition_column` | `tsdb.partitioning_column`; `tsdb.chunk_interval`; `tsdb.create_default_indexes`; `tsdb.segmentby` | `tsdb.segment_by` | `tsdb.compress_segmentby`; `tsdb.orderby` | `tsdb.order_by` | `tsdb.compress_orderby`; `tsdb.index` | `tsdb.sparse_index` | `tsdb.compress_index`. **confirmed**
- The 2.13 "generalized hypertable API" introduced the `by_range()` / `by_hash()` dimension builders for `create_hypertable()`. **confirmed**

### SQL snippets (TimescaleDB 2.30.0 syntax)

Create a hypertable (preferred, 2.20+; columnstore enabled and a columnstore policy created automatically using the chunk interval):

```sql
CREATE TABLE match_events (
  "time"     TIMESTAMPTZ      NOT NULL,
  match_id   UUID             NOT NULL,
  player_id  UUID             NOT NULL,
  kind       TEXT             NOT NULL,
  value      DOUBLE PRECISION NULL
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.chunk_interval   = '1 day',
  tsdb.segmentby        = 'match_id',
  tsdb.orderby          = 'time DESC'
);
```

Create a hypertable (legacy function, 2.13+ dimension-builder form):

```sql
SELECT create_hypertable('match_events', by_range('time', INTERVAL '1 day'));
-- or with options:
SELECT create_hypertable('match_events', by_range('time'), if_not_exists => TRUE);
```

Continuous aggregate + refresh policy:

```sql
CREATE MATERIALIZED VIEW match_events_hourly
WITH (timescaledb.continuous) AS
SELECT match_id,
       time_bucket(INTERVAL '1 hour', "time") AS bucket,
       COUNT(*)   AS events,
       AVG(value) AS avg_value
FROM match_events
GROUP BY match_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('match_events_hourly',
  start_offset      => INTERVAL '1 month',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

Full `add_continuous_aggregate_policy` signature (docs): `continuous_aggregate`, `start_offset`, `end_offset`, `schedule_interval` (required); optional `if_not_exists`, `initial_start`, `timezone`, `include_tiered_data`, `buckets_per_batch`, `max_batches_per_execution`, `refresh_newest_first`. **confirmed**

Enable columnstore (compression) on an existing hypertable + policy (2.18+ syntax):

```sql
ALTER TABLE match_events SET (
  timescaledb.enable_columnstore,
  timescaledb.segmentby = 'match_id',
  timescaledb.orderby   = 'time DESC'
);

CALL add_columnstore_policy('match_events', after => INTERVAL '7 days');
```

Note: `add_columnstore_policy` is a **procedure** (`CALL`), unlike `add_compression_policy()` which was `SELECT`ed. The docs' signature block for `ALTER TABLE` still lists `timescaledb.compress_orderby` / `compress_segmentby` while its example uses `timescaledb.orderby` / `segmentby`; the source accepts both spellings. New settings apply only to chunks not yet converted. **confirmed**

Deprecated equivalents (still work, deprecated 2.18.0):

```sql
ALTER TABLE match_events SET (timescaledb.compress,
  timescaledb.compress_segmentby = 'match_id',
  timescaledb.compress_orderby   = 'time DESC');
SELECT add_compression_policy('match_events', INTERVAL '7 days');
```

Retention policy (Community, since 1.2.0):

```sql
SELECT add_retention_policy('match_events', drop_after => INTERVAL '90 days');
```

Signature: `add_retention_policy(relation, drop_after | drop_created_before, if_not_exists, schedule_interval, initial_start, timezone)`. Only one retention policy per hypertable; works on hypertables and continuous aggregates. **confirmed**

---

## 2. Argon2id and Node.js

### OWASP Password Storage Cheat Sheet (source file last committed 2026-09-05)

- Headline rule: "Use Argon2id with a minimum configuration of 19 MiB of memory, an iteration count of 2, and 1 degree of parallelism." **confirmed**
- Equivalent minimum configurations (all p=1): **confirmed**
  - m=47104 (46 MiB), t=1, p=1 (Do not use with Argon2i)
  - m=19456 (19 MiB), t=2, p=1 (Do not use with Argon2i)
  - m=12288 (12 MiB), t=3, p=1
  - m=9216 (9 MiB), t=4, p=1
  - m=7168 (7 MiB), t=5, p=1
- "If Argon2id is not available, use scrypt"; bcrypt "should only be used for password storage in legacy systems where Argon2 and scrypt are not available." **confirmed**

### RFC 9106 (Informational, IRTF, September 2021)

- First recommended option: "Argon2id with t=1 iteration, p=4 lanes, m=2^(21) (2 GiB of RAM), 128-bit salt, and 256-bit tag size." **confirmed**
- Second (memory-constrained) option: "Argon2id with t=3 iterations, p=4 lanes, m=2^(16) (64 MiB of RAM), 128-bit salt, and 256-bit tag size." **confirmed**
- Salt: 128 bits recommended (64 bits acceptable under space constraints); tag: 128 bits covers most uses. Prefer Argon2id when unsure of the threat model. **confirmed**

Practical setting for a game backend: OWASP m=19456/t=2/p=1 as floor; RFC's 64 MiB/t=3/p=4 if login CPU budget allows. Both far below RFC option 1 (2 GiB) which is unrealistic for a web login path.

### Node.js status (nodejs/Release schedule.json)

| Line | Codename | Start | Active LTS | Maintenance | EOL | Status on 2026-09-12 |
|---|---|---|---|---|---|---|
| v22 | Jod | 2024-04-24 | 2024-10-29 | 2025-10-21 | 2027-04-30 | **Maintenance LTS** |
| v24 | Krypton | 2025-05-06 | 2025-10-28 | 2026-10-20 | 2028-04-30 | **Active LTS** (until 2026-10-20) |
| v26 | (none yet) | 2026-05-05 | 2026-10-28 | 2027-10-20 | 2029-04-30 | **Current** (becomes LTS 2026-10-28) |

**confirmed** (schedule.json; nodejs.org "Previous releases" lists v26 Current, v24 and v22 LTS; docs site currently at v26.8.2).

### Node built-in Argon2

- `crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync(algorithm, parameters)` — "added: v24.7.0" per `doc/api/crypto.md` on the `v24.x` branch. `algorithm` is `"argon2d" | "argon2i" | "argon2id"`; `parameters` = `{ message, nonce (>= 8 bytes; >= 16 recommended), parallelism, tagLength, memory (KiB blocks), passes, secret?, associatedData? }`; returns/derives a `Buffer`. **confirmed**
- Marked stable in v24.19.0 ("doc,crypto: mark argon2 and encap/decap as stable", CHANGELOG_V24). Argon2 WebCrypto algorithms added in v24.8.0. **confirmed**
- Not present in the v22.x docs (`grep crypto.argon2` on the v22.x branch returns nothing). **confirmed**
- Note: the built-in returns a raw derived key, not a PHC-format `$argon2id$...` string; you must store salt/params yourself or format the string by hand. (Inference from the documented API; no primary statement.)

### `argon2` npm package (ranisalt/node-argon2)

- Latest **v0.45.1** (2026-07-21); v0.45.0 (2026-07-18) "dropped support for Node 18 and 20"; v0.44.0 (2025-08-10). npm `latest` = 0.45.1; a `next` tag points to `1.0.0-alpha.1`. **confirmed**
- Native addon (node-gyp / prebuilds), produces PHC strings, `argon2.hash()` / `argon2.verify()`. Still the most-maintained userland option; on Node 24+ the built-in avoids the native dependency.

---

## 3. Fastify (and Hono comparison)

### Fastify core

- Latest stable **v5.12.4** (2026-09-11). Recent: 5.12.2 (2026-09-04, security), 5.12.1 (2026-08-18, security), 5.12.0 (2026-08-13). npm `latest` = 5.12.4, `next` = 6.0.0-alpha.3. **confirmed**
- **v6.0.0-alpha.0 to alpha.3** published 2026-08-11 to 2026-09-04; `main` branch `package.json` is already `6.0.0-alpha.3`. Alpha.0 includes "ci!: increase minimum runtime version" (PR #6904: "Bump minimum node.js version to 24"). **confirmed**
- Fastify 5 LTS table: 5.0.0 released 2024-09-17, Node.js 20 and 22 listed. **confirmed**

### Session / cookie plugins (all target Fastify 5)

| Package | Latest | Date | Notes |
|---|---|---|---|
| `@fastify/cookie` | 11.1.2 | 2026-07-15 | Required by `@fastify/session`. v11 line since 2024-10. **confirmed** |
| `@fastify/session` | 11.1.2 | 2026-07-15 | Server-side sessions; "Requires the @fastify/cookie plugin"; "Defaults to a simple in-memory store ... should not be used in a production environment because it will leak memory"; "Compatible with stores from express-session". **confirmed** |
| `@fastify/secure-session` | 8.3.0 | 2025-12-09 | "secure stateless cookie session ... based on libsodium's Secret Key Box Encryption" (sodium-native); no store needed. **confirmed** |
| `@fastify/rate-limit` | 11.2.0 | 2026-07-29 (security release) | Default in-memory store; `redis` option "requires the use of ioredis" for multi-instance; custom `store` supported; `keyGenerator` defaults to `normalizeIP(request.ip, ipv6Subnet)` (new `ipv6Subnet` option, default /64); `groupId`; v11.0.0 2026-06-09. **confirmed** |

Choice guidance: `@fastify/secure-session` for stateless encrypted cookies (no Redis), `@fastify/session` + a Redis store for revocable server-side sessions.

### Zod validation

- `fastify-type-provider-zod` **7.0.0** (2026-06-24). `package.json` peerDependencies: `fastify ^5.5.0`, `zod >=4.1.5`, `@fastify/swagger >=9.5.1`, `openapi-types ^12.1.3`. 5.0.0 (2025-06-08) switched to the Zod v4 API; 3.0.0 required Fastify 5. Still published from `turkerdev/fastify-type-provider-zod` (not under the `@fastify` org). **confirmed**

### Hono on Node (one paragraph)

Hono is at **v4.13.7** (2026-09-04; engines `node >= 16.9.0`) and runs on Node through `@hono/node-server` **2.1.1** (2026-08-14; engines `node >= 20`, peer `hono ^4`); the docs state "Hono was not designed for Node.js at first, but with a Node.js Adapter, it can run on Node.js as well." Cookies are a built-in helper (`hono/cookie`: `getCookie`, `setCookie`, `getSignedCookie`, `setSignedCookie`, `deleteCookie`; signed cookies use WebCrypto HMAC-SHA-256 and are async). Zod validation is the officially recommended `@hono/zod-validator` (npm latest 0.9.1) via `zValidator('json', schema)` and `c.req.valid()`. Sessions and rate limiting are **not built in**: Hono's "Third-party Middleware" page ("Middleware not bundled within the Hono package") lists `@hono/session` (honojs/middleware) and the community `hono-rate-limiter` (rhinobase). Net: Fastify has first-party, Redis-backed rate limiting and two first-party session strategies with an express-session-compatible store ecosystem; Hono is lighter and Web-standard but you assemble sessions/rate-limits from third-party packages. **confirmed**

---

## 4. Three.js

- Latest **r186**, published **2026-09-08** (npm `three@0.186.0`, `latest`). Previous: r185 (2026-07-01), r184 (2026-04-16), r183 (2026-02-20), r182 (2025-12-10). **confirmed**
- Package `exports` at r186: `.`, `./webgpu`, `./tsl`, `./addons`, `./addons/*`, `./examples/jsm/*`, `./src/*`; `sideEffects: ["./src/nodes/**/*"]`. **confirmed**
- README (r186): "The current builds only include WebGL and WebGPU renderers but SVG and CSS3D renderers are also available as addons." **confirmed**
- r186 release notes: "Deprecate CommonJS build", "Remove minified builds"; TSL "Remove top-level side effects for better tree-shaking"; WebGPURenderer gains `SunLight` with cascaded shadow maps, `DirectRenderPipeline`, async `dispose()`. **single-source** (release page)

### WebGPURenderer status

- Class JSDoc (`src/renderers/webgpu/WebGPURenderer.js`, dev): "This renderer is the new alternative of `WebGLRenderer`. `WebGPURenderer` has the ability to target different backends. By default, the renderer tries to use a WebGPU backend if the browser supports WebGPU. If not, `WebGPURenderer` falls backs to a WebGL 2 backend." Option `forceWebGL=false`: "If set to `true`, the renderer uses a WebGL 2 backend no matter if WebGPU is supported or not." **confirmed**
- `Renderer.init()` is `async` and "Initializes the renderer so it is ready for usage" (returns `Promise<this>`); call `await renderer.init()` before rendering (or use `renderAsync`). **confirmed**
- Import: `import { WebGPURenderer } from 'three/webgpu'`; TSL from `three/tsl`. **confirmed**
- No primary-source statement was found that says "recommended for production" or that `WebGLRenderer` is deprecated; the official wording is "new alternative". Treat WebGPURenderer as production-usable with automatic WebGL 2 fallback, but not officially declared the default. **single-source (absence)**

### Bundle size impact (measured locally, not from docs)

Measured 2026-09-12 with esbuild 0.28.2, `--bundle --minify --format=esm --target=es2022`, `three@0.186.0`, a minimal scene (renderer + PerspectiveCamera + Mesh(BoxGeometry, MeshStandardMaterial) + render):

| Entry | Minified | gzip -9 |
|---|---|---|
| `WebGLRenderer` from `three` | 532,644 B (520 KiB) | 133,564 B (130 KiB) |
| `WebGPURenderer` from `three/webgpu` (+ `init()`) | 787,825 B (769 KiB) | 214,671 B (210 KiB) |
| Delta | +255 KB | **+81 KB gzipped** |

**confirmed** (local measurement; will vary with features used).

### TSL (Three Shading Language)

- Wiki: "An Approach to Productive and Maintainable Shader Creation"; "TSL is also capable of encoding code into different outputs such as `WGSL`/`GLSL` - `WebGPU`/`WebGL`" (`WGSLNodeBuilder` / `GLSLNodeBuilder`); imported from `'three/tsl'`. The wiki gives no formal stability guarantee, but TSL is the shader system of the node-material/WebGPURenderer stack and r186 continues active work on it. **confirmed** (description) / **single-source** (maturity judgement)

### Browser WebGPU support (2026-09)

- **Chrome/Edge**: shipped by default in Chrome 113 (April 2023) on ChromeOS, macOS, Windows; caniuse shows Chrome 113-143 and Edge 113-151 supported. **confirmed**
- **Safari**: WebKit blog (2025-09-15): "WebGPU ... is now shipping in Safari 26.0 for macOS, iOS, iPadOS, and visionOS." caniuse marks iOS Safari 26.0+ supported and macOS Safari 26.0-26.5 "partial" (WebKit bug 299237 reports `navigator.gpu` undefined on macOS Sequoia 15.7 with Safari 26.0.1, i.e. macOS-version dependent). **confirmed** (shipping) / **single-source** (partial on older macOS)
- **Firefox**: 141.0 (2025-07-22) "Enabled the WebGPU API on Windows."; 145.0 (2025-11-11) "The WebGPU DOM API is now available on macOS 26 (Tahoe) on Apple Silicon."; 147.0 (2026-01-13) "WebGPU support is now enabled for devices with Apple Silicon processors on all supported macOS versions." **Linux: not enabled in release** — caniuse lists Firefox 156-158 as "Disabled by default", and no 141-147 release note mentions Linux. **confirmed** (141/145/147) / **single-source** (Linux status)
- caniuse global usage with WebGPU: 85.72 % full + 1.63 % partial = **87.35 %**. **single-source** (caniuse)
- MDN: "Limited availability - not Baseline"; secure context (HTTPS) required. **confirmed**

Implication: WebGPURenderer with automatic WebGL 2 fallback is the right default; Firefox-on-Linux and pre-Tahoe macOS Safari will take the WebGL 2 path.

---

## 5. Drizzle ORM vs postgres.js

### Versions

- **drizzle-orm**: npm `latest` = **0.45.2** (2026-03-27); `beta` = 1.0.0-beta.22; `rc` = **1.0.0-rc.4** (2026-06-27); an `rc5` pre-tag (`1.0.0-rc.5-5935859`) exists. GitHub releases: rc.4 (2026-06-27), rc.3 (2026-05-18), rc.2 (2026-05-05), rc.1 (2026-04-30). No 1.0.0 stable as of 2026-09-12. `main` branch package.json reads 0.45.3 (unreleased). **confirmed**
- **drizzle-kit**: npm `latest` = **0.31.10** (2026-03-17); `rc` = 1.0.0-rc.4. **confirmed**
- **postgres.js** (`postgres`): **v3.4.9** (2026-04-05); v3.4.8 (2026-01-06); v3.4.7 (2025-05-21). npm `latest` = 3.4.9. **confirmed**
- Drizzle "native support for PostgreSQL connections with the node-postgres and postgres.js drivers"; import `import { drizzle } from 'drizzle-orm/postgres-js'`. **confirmed**

### Migration tooling

- Documented workflows: `drizzle-kit generate` (SQL files from schema diff) + `drizzle-kit migrate` (CLI) or runtime migrator; `drizzle-kit push` (no files); `drizzle-kit pull` (introspect); `drizzle-kit export` (for Atlas etc.). **confirmed**
- Custom SQL migrations: `drizzle-kit generate --custom --name=<name>` creates an empty migration "for DDL alternations currently not supported by Drizzle Kit or data seeding", applied by `drizzle-kit migrate`. **confirmed**
- 1.0.0-rc.4 adds `--output json` envelopes, a programmatic SDK at `drizzle-kit/cli`, `--hints` for non-interactive rename/data-loss decisions, `drizzle-kit mcp`, and `drizzle-kit skills`. **single-source** (release notes)

### Timescale-specific DDL

- Drizzle docs (migrations, custom migrations, PostgreSQL guides) contain **no mention** of TimescaleDB or hypertables. **confirmed**
- Open issues on drizzle-team/drizzle-orm: #2962 "[FEATURE]: Timescale extension support" (open since 2024-09-13), #4621 "[Pg] Support for timescaledb continuous aggregates" (open since 2025-06-06), #3672 "Allow passing in arbitrary strings into `pgMaterializedView().with()`" (open). **confirmed**
- Conclusion: define the table in Drizzle schema for typed queries, then add **custom SQL migrations** (`drizzle-kit generate --custom`) for `CREATE TABLE ... WITH (tsdb.hypertable ...)` / `create_hypertable()`, `CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)`, `add_continuous_aggregate_policy`, `ALTER TABLE ... SET (timescaledb.enable_columnstore ...)`, `CALL add_columnstore_policy`, `add_retention_policy`. Because `tsdb.hypertable` is a `CREATE TABLE` option, the cleanest approach is to let the custom migration create the hypertable itself (or run `create_hypertable()` right after Drizzle's generated `CREATE TABLE`). Continuous aggregates cannot be expressed in Drizzle's `pgMaterializedView().with()` (#3672), so query them via `sql` or a plain `pgTable`/view declaration that mirrors the columns. **confirmed** (facts) / inference (approach)
- `drizzle-kit push` diffs live schema; it does not know about hypertable-internal `_timescaledb_internal` chunk tables, so review `push` output carefully or prefer `generate`+`migrate` on Timescale databases. (Inference; no primary statement.)

---

## Sources (all accessed 2026-09-12)

TimescaleDB
- https://github.com/timescale/timescaledb/releases (and GitHub API `repos/timescale/timescaledb/releases`)
- https://github.com/timescale/timescaledb/releases/tag/2.30.0
- https://github.com/timescale/timescaledb/releases/tag/2.29.0
- https://hub.docker.com/r/timescale/timescaledb and `/tags?name=pg18`, `/tags?name=2.30.0`
- https://hub.docker.com/r/timescale/timescaledb-ha and `/tags?name=pg18`
- https://raw.githubusercontent.com/timescale/timescaledb-docker/main/README.md, `Makefile`, `Dockerfile`
- https://raw.githubusercontent.com/timescale/timescaledb-docker-ha/master/README.md
- https://www.tigerdata.com/docs/self-hosted/latest/install/installation-docker
- https://www.tigerdata.com/docs/api/latest/hypertable/create_table
- https://www.tigerdata.com/docs/reference/timescaledb/hypertables/create_hypertable
- https://www.tigerdata.com/docs/use-timescale/latest/continuous-aggregates/create-a-continuous-aggregate
- https://www.tigerdata.com/docs/api/latest/continuous-aggregates/add_continuous_aggregate_policy
- https://www.tigerdata.com/docs/api/latest/continuous-aggregates/create_materialized_view
- https://www.tigerdata.com/docs/use-timescale/latest/hypercore
- https://www.tigerdata.com/docs/api/latest/hypercore/alter_table
- https://www.tigerdata.com/docs/api/latest/hypercore/add_columnstore_policy
- https://www.tigerdata.com/docs/api/latest/data-retention/add_retention_policy
- https://www.tigerdata.com/docs/about/latest/timescaledb-editions
- https://github.com/timescale/timescaledb/tree/main/tsl (LICENSE-TIMESCALE, `tsl/src/bgw_policy`, `compression`, `continuous_aggs`)
- https://raw.githubusercontent.com/timescale/timescaledb/2.30.0/src/with_clause/create_table_with_clause.c

Argon2 / Node.js
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html (source: https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Password_Storage_Cheat_Sheet.md, last commit 2026-09-05)
- https://www.rfc-editor.org/rfc/rfc9106.html
- https://github.com/ranisalt/node-argon2/releases
- https://nodejs.org/en/about/previous-releases
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
- https://nodejs.org/api/crypto.html and https://raw.githubusercontent.com/nodejs/node/v24.x/doc/api/crypto.md, `.../v22.x/doc/api/crypto.md`
- https://raw.githubusercontent.com/nodejs/node/v24.x/doc/changelogs/CHANGELOG_V24.md

Fastify / Hono
- https://github.com/fastify/fastify/releases ; https://github.com/fastify/fastify/pull/6904 ; `docs/Reference/LTS.md` at v5.12.4
- https://github.com/fastify/session/releases and README
- https://github.com/fastify/fastify-secure-session/releases and README
- https://github.com/fastify/fastify-cookie/releases
- https://github.com/fastify/fastify-rate-limit/releases and README
- https://github.com/turkerdev/fastify-type-provider-zod/releases and `package.json`
- https://github.com/honojs/hono/releases ; https://github.com/honojs/node-server/releases ; both `package.json`
- https://hono.dev/docs/getting-started/nodejs
- https://hono.dev/docs/helpers/cookie
- https://hono.dev/docs/guides/validation
- https://hono.dev/docs/middleware/third-party
- npm registry dist-tags (`npm view <pkg> dist-tags`) for all packages above

Three.js / WebGPU
- https://github.com/mrdoob/three.js/releases ; https://github.com/mrdoob/three.js/releases/tag/r186
- https://raw.githubusercontent.com/mrdoob/three.js/r186/package.json, `README.md`
- https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/webgpu/WebGPURenderer.js
- https://raw.githubusercontent.com/mrdoob/three.js/r186/src/renderers/common/Renderer.js
- https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- https://threejs.org/docs/#api/en/renderers/WebGPURenderer (SPA; content not fetchable, used source JSDoc instead)
- https://threejs.org/manual/#en/installation (could not be fetched; SPA)
- https://caniuse.com/webgpu
- https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API (last modified 2026-09-02; compat table not fetchable as text)
- https://developer.chrome.com/blog/webgpu-release
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://bugs.webkit.org/show_bug.cgi?id=299237
- https://www.firefox.com/en-US/firefox/141.0/releasenotes/
- https://www.firefox.com/en-US/firefox/145.0/releasenotes/
- https://www.firefox.com/en-US/firefox/147.0/releasenotes/
- https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes (could not be fetched; body not rendered)
- Local bundle measurement: `/tmp/threesize` with esbuild 0.28.2 and three@0.186.0

Drizzle / postgres.js
- https://github.com/drizzle-team/drizzle-orm/releases ; https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-rc.4
- https://github.com/porsager/postgres/releases
- https://orm.drizzle.team/docs/migrations
- https://orm.drizzle.team/docs/kit-custom-migrations
- https://orm.drizzle.team/docs/get-started-postgresql
- https://github.com/drizzle-team/drizzle-orm/issues/2962 , /issues/4621 , /issues/3672
- npm registry `time` and `dist-tags` for drizzle-orm, drizzle-kit, postgres
