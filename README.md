# The Relic Ring Protocol — Stack Kings (LAUNCH 26)

A simulation of a ruthlessly efficient routing protocol that reconnects the
**Zeta-26** star system over fragmented legacy infrastructure. The system ingests
a `universe-config.json`, models physical propagation latency, translates between
each planet's numerical dialect (codex), finds the lowest-latency route under a
maximum void-hop constraint, and dynamically reroutes around node/link failures.

Built with Next.js (App Router) + TypeScript. The protocol engine is headless and
fully unit-tested; an interactive telemetry dashboard and a CLI expose it for the
demo milestones.

**Live demo:** [https://relic.inusha.me/relic](https://relic.inusha.me/relic) ·
[https://launch-26-stack-kings.vercel.app/relic](https://launch-26-stack-kings.vercel.app/relic)

---

## Quick start

```bash
npm install
npm run dev
```

- Telemetry dashboard: open [http://localhost:3000/relic](http://localhost:3000/relic)
- Terminal demo (M1-M4): `npm run relic`
- Tests: `npm test`
- Coverage: `npm run test:coverage`
- E2E smoke (Playwright): `npx playwright install chromium && npm run test:e2e`
- Production build: `npm run build && npm start`

### Run with Docker

```bash
docker build -t relic-ring .
docker run --rm -p 3000:3000 relic-ring
```

Then open [http://localhost:3000/relic](http://localhost:3000/relic).

---

## What this implements (scope)

This started as one member's portion of a three-person team project. The two
teammate-facing modules are isolated behind TypeScript interfaces in
[`src/lib/relic/contracts.ts`](src/lib/relic/contracts.ts):

- **Mapping** (`GeometryProvider`) — tower placement, center/void distances, the
  line-of-sight closest tower pair, and ring segment counts. Backed by a complete,
  correct provider in [`src/lib/relic/stubs/geometry.stub.ts`](src/lib/relic/stubs/geometry.stub.ts);
  the interactive map UI lives in [`src/components/telemetry/`](src/components/telemetry).
- **Encoding/Decoding** (`Codec`) — codex base conversion, ASCII representation, and
  binary-stream serialization. Implemented in
  [`src/lib/relic/codec.ts`](src/lib/relic/codec.ts) (`RelicCodec`): the void stream
  serializes the **next-hop codex digits** (not raw ASCII), matching the protocol flow.

Everything else is implemented here: config parsing, the latency engine, routing,
resilience, the packet/`hop_log` orchestration, and the runnable surfaces (API,
dashboard, CLI). See [Team integration](#team-integration--merge-checklist).

---

## Usage

### CLI

```bash
npm run relic                 # scripted M1 -> M2/M3 -> M4 walkthrough
npm run relic -- init         # M1: print universe + reachable links
npm run relic -- send Aegis Caelum "Hello world"
npm run relic -- send Aegis Caelum "Hello world" --kill Dawn --cut Aegis-Boreas
```

### HTTP API

- `GET /api/health` — liveness probe (version, config path/hash, engine status).
- `GET /api/universe` — **M1**: metadata, nodes, adjacency, and the within-Lmax edges (cached 1 h).
- `POST /api/transmit` — **M2/M3/M4** (payload capped at 10 KB; structured error codes):

```bash
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/transmit \
  -H "Content-Type: application/json" \
  -d '{"origin":"Aegis","destination":"Caelum","payload":"Hello world","blockedNodes":["Dawn"]}'
```

Returns the `packet` (with `hop_log`), the `route` (path + latency breakdown), and
the reconstructed `delivered_payload`. API routes are rate-limited (120 req/min per client).

**Config override:** set `UNIVERSE_CONFIG_PATH` to point at an alternate
`universe-config.json` before starting the server or container.

---

## How it works

### Transmission flow

```
Raw payload -> next-hop codex -> binary stream -> void -> destination codex
            -> local decoding (ASCII for internal tower routing)
```

Each planet receives data already encoded in **its own** codex (the previous
planet encodes into the next hop's dialect before transmitting), so the `hop_log`
records every planet's payload in its own dialect — proving the chain of
conversions. Each non-final `hop_log` entry also carries `next_hop_codex`,
`next_hop_dialect`, and the serialized `binary_stream` that actually crosses the
void, so the encoding translation at every hop is fully visible (M2). The codec
round-trip is actually executed per hop, so the delivered payload is a genuine
reconstruction, not an assumption.

### Telemetry dashboard (`/relic`)

The dashboard ([`src/components/telemetry/`](src/components/telemetry)) is the main
demo surface: an interactive `SpaceMap` (click planets to set origin/destination,
click planets/links to fail them), latency gauges (M3), and a Codex Terminal that
shows the per-hop local dialect, the next-hop conversion, and the binary stream
(M2). One-click scenario presets (Baseline, Hyper-Flare, Distortion, Blackout,
Chaos) inject failures for the M4 resilience demo; their targets are derived from
the loaded universe, not hardcoded.

### Latency model

All latencies are computed in **milliseconds** and every constant is read from
`universe_metadata` (never hardcoded).

- **Void distance** `L = scale * sqrt((x2-x1)^2 + (y2-y1)^2) - (R1+h1) - (R2+h2)`
- **Void travel time** `Tv = (h1*n1 + h2*n2 + L) / C`
  - atmosphere component `(h1*n1 + h2*n2) / C`, void component `L / C`
- **Internal crust transit** `Tp = (2*pi*r*s) / (N*f*C) + m*dt`
  - fiber component `(2*pi*r*s) / (N*f*C)`, tower component `m*dt`
- **Total** `Sum(Tp over planets visited) + Sum(Tv over void hops)`

where `s` = ring segments between entry and exit tower, `m` = distinct towers hit
(`m = s + 1`; the dedup case entry = exit gives `s = 0`, `m = 1`).

### Routing

Routing finds the **lowest-latency** path, enforcing the `Lmax` single void-hop
limit (longer gaps are bridged through intermediate planets; if nothing bridges
them, the route is undeliverable). Because `Tp` at a planet depends on both the
incoming and outgoing hop (entry tower vs. exit tower), a plain node-weighted
shortest path would be incorrect. We run **Dijkstra over an expanded state space**
`(planet, entryTower)`, charging a planet's `Tp` when leaving it. See
[`src/lib/relic/router.ts`](src/lib/relic/router.ts).

### Resilience

`ResilientNetwork` ([`src/lib/relic/resilience.ts`](src/lib/relic/resilience.ts))
tracks failed nodes/links and recomputes the route on every send, so packets are
instantly rerouted around dead zones without data loss and reported undeliverable
when a destination is isolated.

---

## Assumptions and constant justifications

Constants come from `universe_metadata`. The four below fall back to the documented
defaults **only when absent**; `coordinate_scale_unit_km` is required (it has no
physically meaningful default and changes all distances).

| Constant                    | Default    | Justification                                                                                                 |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `speed_of_light_kms`        | `300000`   | Speed of light `C` in km/s, per the spec.                                                                     |
| `max_void_hop_distance_km`  | `50000000` | `Lmax`; a single laser hop across the void cannot exceed it. `L == Lmax` is treated as reachable (inclusive). |
| `tower_processing_delay_ms` | `7`        | Fixed processing penalty `dt` charged per distinct tower hit.                                                 |
| `fiber_speed_fraction`      | `0.67`     | Fiber propagation runs at `0.67c` along the equatorial ring.                                                  |
| `coordinate_scale_unit_km`  | required   | Multiplies abstract grid units to km. `radius_km` is already in km and is never scaled.                       |

Modeling assumptions (consistent with the challenge's simplifications):

- **Geometry**: planets are 2D circles; `active_towers` towers sit at equal angular
  intervals starting at the top (positive y-axis), indexed clockwise from Tower 0.
- **Void distance simplification**: `L` is center-based; tower angular position does
  **not** affect `L`. The closest tower pair (line of sight) only selects which
  towers send/receive and feeds the internal fiber arc (`Tp`) and `hop_log`.
- **Atmosphere**: treated as constant refraction over thickness `h`; the atmospheric
  transit distance is exactly `h` per planet (straight through), with effective
  optical distance `h*n`.
- **Tower dedup**: when entry tower = exit tower, only one tower is charged (`s = 0`,
  `m = 1`). Origin and destination each touch a single tower (`s = 0`).
- **Internal transit**: within a planet, messages live as ASCII while routed between
  towers; each planet receives in its own codex.
- **Shortest path = lowest latency**, using the full `Tp + Tv` cost.

---

## Project structure

```
src/
  lib/relic/          # engine (routing, latency, codec, transmission, resilience)
  lib/api/            # validation, logging, rate limiting, route handler
  components/telemetry/  # SpaceMap, LatencyMetrics, CodexTerminal, RelicDashboard
  app/
    relic/page.tsx    # telemetry dashboard mount
    api/              # health, universe, transmit, debug/sentry
  cli/relic.ts        # terminal demo (M1-M4)
e2e/                  # Playwright smoke tests
.github/workflows/    # CI (lint, test, coverage, E2E, Docker) + deploy
universe-config.json  # the Zeta-26 universe (parsed dynamically)
```

Reference docs: [`Equations.md`](Equations.md) · [`Launch26.md`](Launch26.md) · [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

---

## Demo milestone mapping

| Milestone                                            | Where to see it                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| M1 — Universe initialization                         | `npm run relic -- init`, or `GET /api/universe`, or load `/relic`                      |
| M2 — Multi-hop proof (dialect translations)          | `/relic` Codex Terminal (local + next-hop dialect + binary stream), or `npm run relic` |
| M3 — Latency breakdown (fiber/tower/atmosphere/void) | `/relic` latency gauges, or CLI output                                                 |
| M4 — Chaos test (kill node/link, reroute)            | `/relic` scenario presets / click a planet or link, or `npm run relic`                 |

---

## Team integration / merge checklist

Modules plug in at the single composition root,
[`src/lib/relic/engine.ts`](src/lib/relic/engine.ts):

1. **Encoding/Decoding** — done: `createRelicCodec()`
   ([`codec.ts`](src/lib/relic/codec.ts)) is wired in. To substitute a different
   `Codec`, swap that one line.
2. **Mapping** — `createStubGeometryProvider(...)` is a complete, correct
   `GeometryProvider`. If a dedicated mapping module is provided, replace that line.
3. Run `npm test` — the codec, latency, routing, transmission, and `hop_log` suites
   act as integration tests (including the "Hello world" base-5 / base-14 proof and
   payload-integrity checks).
4. The **telemetry dashboard** consumes `GET /api/universe` and `POST /api/transmit`;
   no engine changes are needed to integrate it.

No other file needs to change to swap a module.

---

## Branch workflow

Development happens on **`inusha-dev`**; production deploys from **`main`** (Vercel Git integration).

1. Work on `inusha-dev` locally — verify with the [Quick start](#quick-start) commands.
2. Push to `origin/inusha-dev`.
3. Open a pull request **`inusha-dev` → `main`** — CI must pass (lint, typecheck, coverage, build, E2E, Docker).
4. Merge to `main` to update production (`relic.inusha.me`).

Pushes to `inusha-dev` do **not** auto-merge into `main`.

---

## Deployment

### Vercel (recommended)

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Framework is auto-detected (Next.js). `vercel.json` is included.
3. Copy [`.env.example`](.env.example) variables into the Vercel project settings as needed
   (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SITE_URL`, etc.).
4. Deploy — `/relic` is the demo surface; `/api/health` is the liveness probe.
5. **Custom domain (optional):** add a subdomain (e.g. `relic.yourdomain.com`) in Vercel
   **Settings → Domains**, then create the CNAME + TXT records your DNS provider shows.

**GitHub Actions deploy:** add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and
`VERCEL_PROJECT_ID`. Pushes to `main` then run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
automatically (skipped when secrets are absent).

### Docker

```bash
docker build -t relic-ring .
docker run --rm -p 3000:3000 relic-ring
curl http://localhost:3000/api/health
```

---

## Observability

- **Structured API logs:** every `/api/*` request emits a single-line JSON log
  (`route`, `method`, `status`, `duration_ms`) via [`src/lib/api/logging.ts`](src/lib/api/logging.ts).
- **Health probe:** `GET /api/health` returns `version`, `config_path`, `config_hash`, and
  `engine_loaded` for deploy verification.
- **Sentry (optional):** set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser).
  When unset, Sentry is fully disabled — no account required for local dev.
- **Error boundaries:** `global-error.tsx` and the dashboard error boundary capture UI failures.

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS · Vitest · Playwright · tsx · Sentry · Prettier · Husky

## Quality & testing

- **Unit tests:** Vitest (`src/**/*.test.ts`) — engine, API helpers, validation
- **API integration:** `src/app/api/api.integration.test.ts` — health, universe, transmit edge cases
- **E2E smoke:** Playwright (`e2e/relic.spec.ts`) — dashboard load, chaos scenario, manual transmit
- **CI:** GitHub Actions runs lint, typecheck, coverage, build, Docker, and E2E on `main`
- **Pre-commit:** husky + lint-staged (Prettier + ESLint on staged files)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

---

We are continuously improving this project through teamwork, innovation, and community feedback.
