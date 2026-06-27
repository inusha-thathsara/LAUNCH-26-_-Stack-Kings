# The Relic Ring Protocol — Stack Kings (LAUNCH 26)

A simulation of a ruthlessly efficient routing protocol that reconnects the
**Zeta-26** star system over fragmented legacy infrastructure. The system ingests
a `universe-config.json`, models physical propagation latency, translates between
each planet's numerical dialect (codex), finds the lowest-latency route under a
maximum void-hop constraint, and dynamically reroutes around node/link failures.

Built with Next.js (App Router) + TypeScript. The protocol engine is headless and
fully unit-tested; an interactive telemetry dashboard and a CLI expose it for the
demo milestones.

---

## Quick start

```bash
npm install
npm run dev
```

- Telemetry dashboard: open [http://localhost:3000/relic](http://localhost:3000/relic)
- Terminal demo (M1-M4): `npm run relic`
- Tests: `npm test`
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

- `GET /api/universe` — **M1**: metadata, nodes, adjacency, and the within-Lmax edges.
- `POST /api/transmit` — **M2/M3/M4**:

```bash
curl -X POST http://localhost:3000/api/transmit \
  -H "Content-Type: application/json" \
  -d '{"origin":"Aegis","destination":"Caelum","payload":"Hello world","blockedNodes":["Dawn"]}'
```

Returns the `packet` (with `hop_log`), the `route` (path + latency breakdown), and
the reconstructed `delivered_payload`.

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

| Constant | Default | Justification |
| --- | --- | --- |
| `speed_of_light_kms` | `300000` | Speed of light `C` in km/s, per the spec. |
| `max_void_hop_distance_km` | `50000000` | `Lmax`; a single laser hop across the void cannot exceed it. `L == Lmax` is treated as reachable (inclusive). |
| `tower_processing_delay_ms` | `7` | Fixed processing penalty `dt` charged per distinct tower hit. |
| `fiber_speed_fraction` | `0.67` | Fiber propagation runs at `0.67c` along the equatorial ring. |
| `coordinate_scale_unit_km` | required | Multiplies abstract grid units to km. `radius_km` is already in km and is never scaled. |

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
  lib/relic/
    types.ts          # domain model + mandatory packet/hop_log schema
    contracts.ts      # GeometryProvider + Codec interfaces (teammate modules)
    config.ts         # dynamic config parser + validator (metadata defaults)
    codec.ts          # RelicCodec: codex <-> ASCII + reversible binary stream
    latency.ts        # Tv, Tp, and route component breakdown
    graph.ts          # network graph (L <= Lmax edges)
    router.ts         # state-expanded Dijkstra (lowest-latency routing)
    transmission.ts   # packet lifecycle + hop_log orchestration
    resilience.ts     # kill/revive nodes & links, dynamic rerouting
    engine.ts         # composition root (teammate swap point)
    stubs/            # functional geometry provider + reference stub codec
    server/universe.ts# Node-only config loader (cached engine)
  components/telemetry/ # SpaceMap, LatencyMetrics, CodexTerminal, RelicDashboard
  app/
    relic/page.tsx    # telemetry dashboard mount
    api/universe      # GET  /api/universe  (M1)
    api/transmit      # POST /api/transmit  (M2/M3/M4)
  cli/relic.ts        # terminal demo (M1-M4)
universe-config.json  # the Zeta-26 universe (parsed dynamically)
Equations.md          # reference: the challenge latency equations
Launch26.md           # reference: the challenge brief
```

---

## Demo milestone mapping

| Milestone | Where to see it |
| --- | --- |
| M1 — Universe initialization | `npm run relic -- init`, or `GET /api/universe`, or load `/relic` |
| M2 — Multi-hop proof (dialect translations) | `/relic` Codex Terminal (local + next-hop dialect + binary stream), or `npm run relic` |
| M3 — Latency breakdown (fiber/tower/atmosphere/void) | `/relic` latency gauges, or CLI output |
| M4 — Chaos test (kill node/link, reroute) | `/relic` scenario presets / click a planet or link, or `npm run relic` |

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

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS · Vitest · tsx
