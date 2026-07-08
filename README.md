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
- Model training (Phase 2): `npm run train:models` · `npm run evaluate:models`
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

- `GET /api/health` — liveness probe (version, config path/hash, engine status, plus
  Chimera `models_loaded` / `chimera_reachable` / `last_tick`).
- `GET /api/universe` — **M1**: metadata, nodes, adjacency, and the within-Lmax edges (cached 1 h).
- `POST /api/transmit` — **M2/M3/M4** (payload capped at 10 KB; structured error codes).
  Optional `"use_copilot": true` attaches a Co-Pilot routing report and transmits
  along the Co-Pilot `chosen_path` when deliverable.
- `POST /api/route` — **Phase 2**: natural-language Co-Pilot routing (see below).

```bash
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/transmit \
  -H "Content-Type: application/json" \
  -d '{"origin":"Aegis","destination":"Caelum","payload":"Hello world","blockedNodes":["Dawn"]}'

curl -X POST http://localhost:3000/api/route \
  -H "Content-Type: application/json" \
  -d '{"request":"Send \"status ping\" from Aegis to Caelum"}'
```

Returns the `packet` (with `hop_log`), the `route` (path + latency breakdown), and
the reconstructed `delivered_payload`. API routes are rate-limited (120 req/min per client).

**Config override:** set `UNIVERSE_CONFIG_PATH` to point at an alternate
`universe-config.json` before starting the server or container.

---

## Phase 2 — Chimera Co-Pilot

The Co-Pilot turns a plain-English request into an intelligent, risk-aware route
over the live **Chimera** telemetry stream. It layers three analytical models
(congestion, trust, targeting) into a single **True Cost** and routes to minimise
it, then emits a mandatory `Phase2RoutingReport` explaining every decision.

```bash
curl -X POST http://localhost:3000/api/route \
  -H "Content-Type: application/json" \
  -d '{"request":"Send \"status ping\" from Aegis to Caelum"}'
```

- **Hybrid NL parser** — a fast rules layer (from/to, arrow, fuzzy planet matching,
  quoted/`send …` payload) with an optional LLM fallback (`CHIMERA_LLM_PROVIDER=ollama|gemini`);
  offline-deterministic by default. See [`src/lib/chimera/parser/`](src/lib/chimera/parser).
- **True Cost router** — combines predicted congestion penalty, trust, and targeting
  risk per link; steers around jammed/compromised/out-of-distribution links.
  See [`src/lib/chimera/router/true-cost-router.ts`](src/lib/chimera/router/true-cost-router.ts).
- **Anomaly handling** — `detectLinkAnomaly` sanitises out-of-distribution telemetry
  and applies conservative scores so the report always validates and the router
  avoids unfamiliar links. See [`challenge/DECISION_AUDIT.md`](challenge/DECISION_AUDIT.md).
- **Transmit integration** — `POST /api/transmit` with `"use_copilot": true` returns the
  `routing_report` **and** transmits the packet along the Co-Pilot's `chosen_path`
  (`transmitted_on_copilot_path: true`), falling back to the physics baseline if that
  path is severed.
- **Dashboard** — the `/relic` Co-Pilot panel shows the parsed intent (live preview
  before routing), the chosen vs. baseline path overlay, per-link evaluations, and a
  **Live Chaos Monitor** that re-polls and animates path pivots. Demo flow:
  [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).

### Model findings (Intelligence Walkthrough)

Trained on CSVs only (`challenge p2/` datasets — never on scrambled live `/state`).
Regenerate with `npm run train:models` and `npm run evaluate:models`. Full metrics
in [`challenge/INTELLIGENCE_REPORT.md`](challenge/INTELLIGENCE_REPORT.md); surfaced
in the dashboard **Intelligence Walkthrough** panel.

| Model          | Key finding                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Congestion** | Per-link power-law `penalty_ms = k · load_ratio^p`; global MAE ~22.7 s on held-out ticks           |
| **Trust**      | Two links systematically under-report latency: **Aegis-Elysium**, **Boreas-Fenix** (92% precision) |
| **Targeting**  | Higher `traffic_share` → higher jam probability; route diversification avoids predictable paths    |

Decision-audit formulas (plain English): [`challenge/DECISION_AUDIT.md`](challenge/DECISION_AUDIT.md).

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
Chaos) inject failures for the M4 resilience demo.

**Phase 2 Co-Pilot panel:** natural-language routing request, live parsed-intent
preview (origin → destination + payload), link evaluations table with expandable
decision-audit rows, intelligence walkthrough summary, chosen vs. baseline path
toggle on the map, live chaos monitor with pivot banner, and **Initiate Void Beam**
which transmits along the Co-Pilot path when a routing report is present.

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
  lib/chimera/        # Phase 2: client, models, parser, agent, true-cost router
  lib/api/            # validation, logging, rate limiting, route handler
  components/telemetry/  # SpaceMap, RelicDashboard, LinkEvaluationsPanel, …
  app/
    relic/page.tsx    # telemetry dashboard mount
    api/              # health, universe, transmit, route, debug/sentry
  cli/relic.ts        # terminal demo (M1-M4)
challenge/
  INTELLIGENCE_REPORT.md   # model evaluation findings (Intelligence Walkthrough)
  DECISION_AUDIT.md        # score-field cheat sheet (Decision Audit trial)
e2e/                  # Playwright smoke tests (7 specs incl. Co-Pilot flows)
.github/workflows/    # CI (lint, test, coverage, E2E, Docker) + deploy
challenge p2/universe-config.json  # Phase 2 extended config (12 links, default)
```

Reference docs: [`Equations.md`](Equations.md) · [`Launch26.md`](Launch26.md) · [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) · [`challenge/DECISION_AUDIT.md`](challenge/DECISION_AUDIT.md)

---

## Demo milestone mapping

| Milestone                                            | Where to see it                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| M1 — Universe initialization                         | `npm run relic -- init`, or `GET /api/universe`, or load `/relic`                      |
| M2 — Multi-hop proof (dialect translations)          | `/relic` Codex Terminal (local + next-hop dialect + binary stream), or `npm run relic` |
| M3 — Latency breakdown (fiber/tower/atmosphere/void) | `/relic` latency gauges, or CLI output                                                 |
| M4 — Chaos test (kill node/link, reroute)            | `/relic` scenario presets / click a planet or link, or `npm run relic`                 |
| P2 — Intelligence Walkthrough                        | `/relic` Intelligence Summary panel, or `challenge/INTELLIGENCE_REPORT.md`             |
| P2 — Live NL route + Co-Pilot report                 | `/relic` Co-Pilot panel → **Route with Co-Pilot**, or `POST /api/route`                |
| P2 — Chaos severance pivot                           | `/relic` **Live Chaos Monitor** + scenario presets                                     |
| P2 — Decision audit                                  | `/relic` Link Evaluations table (click row), or `challenge/DECISION_AUDIT.md`          |

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
   (`CHIMERA_TEAM_KEY`, `CHIMERA_API_BASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
   `NEXT_PUBLIC_SITE_URL`, etc.). **`CHIMERA_TEAM_KEY` is required** for live Co-Pilot
   routing in production (server-side only — never expose to the browser).
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
- **Health probe:** `GET /api/health` returns `version`, `config_path`, `config_hash`,
  `engine_loaded`, and Chimera fields (`models_loaded`, `chimera_reachable`, `last_tick`)
  for deploy verification.
- **Sentry (optional):** set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser).
  When unset, Sentry is fully disabled — no account required for local dev.
- **Error boundaries:** `global-error.tsx` and the dashboard error boundary capture UI failures.

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS · Vitest · Playwright · tsx · Sentry · Prettier · Husky

## Quality & testing

- **Unit tests:** Vitest (`src/**/*.test.ts`) — engine, Chimera models/agent/router, API helpers
- **API integration:** `src/app/api/api.integration.test.ts` — health, universe, transmit, `/api/route`
- **E2E smoke:** Playwright (`e2e/relic.spec.ts`, 7 tests) — dashboard load, chaos scenario, Co-Pilot route, live monitor pivot
- **Model training/eval:** `npm run train:models` · `npm run evaluate:models` → `challenge/INTELLIGENCE_REPORT.md`
- **CI:** GitHub Actions runs lint, typecheck, coverage, build, Docker, and E2E on `main`
- **Pre-commit:** husky + lint-staged (Prettier + ESLint on staged files)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

---

We are continuously improving this project through teamwork, innovation, and community feedback.
