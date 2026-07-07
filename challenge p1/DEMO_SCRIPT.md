# The Relic Ring Protocol — Demo Video Script

**Team:** Stack Kings · **Event:** LAUNCH 26 · **Target length:** ~11–12 min (max 15)

Covers the four required milestones: **M1** Universe Initialization, **M2** Multi-Hop Proof,
**M3** Latency Breakdown, **M4** Chaos Test.

## Before recording

- Dependencies installed (`npm install`).
- A terminal open in the project root.
- Browser ready at `http://localhost:3000/relic` (Next.js falls back to `3001` if port 3000 is busy).
- **Or** use the live demo: [https://relic.inusha.me/relic](https://relic.inusha.me/relic)
- Do one dry run — the dashboard auto-transmits on changes, so pause a beat after each click.

---

## 0. Intro — (0:00–1:00)

**Say:**

> "Hi, we're team Stack Kings. This is our submission for the Relic Ring Protocol — a routing
> protocol that reconnects the Zeta-26 star system over primitive legacy infrastructure. It models
> real physical latency, translates between each planet's numerical dialect, finds the
> lowest-latency route under a maximum hop distance, and reroutes around failures. It's built with
> Next.js, TypeScript, and a fully unit-tested engine. We'll walk through the four milestones,
> M1 to M4."

---

## 1. M1 — Universe Initialization — (1:00–3:00)

**Do:** Open `universe-config.json`. Scroll through `universe_metadata`, then a couple of `nodes`.

**Say:**

> "Everything starts from this config file. The `universe_metadata` holds the system-wide constants
> — speed of light, the Lmax hop limit, tower processing delay, and the fiber speed fraction.
> Crucially, none of these are hardcoded; they're all read from config. Each planet defines its id,
> its `codex` — the numerical base it receives data in — coordinates, radius, tower count,
> atmosphere thickness, and refraction index."

**Do:** In a terminal, run `npm run dev`, then open `http://localhost:3000/relic`.

**Say:**

> "When we boot the system, it ingests that config and spins up the network. Here's the Zeta-26
> telemetry console. The header shows the constants pulled straight from metadata, and this map
> renders all six planets — Aegis, Boreas, Dawn, Elysium, Fenix, Caelum — with the valid laser
> links between them: every pair whose void distance is within Lmax."

**Do (optional):** In a second terminal, run `npm run relic -- init` to show the same data as text.

**Say:**

> "The same initialization is available headlessly via our CLI and the `/api/universe` endpoint."

---

## 2. M2 — Multi-Hop Proof — (3:00–6:00)

**Do:** Set Origin = **Aegis**, Destination = **Caelum**, payload = **Hello world**.

**Say:**

> "Now let's send 'Hello world' from Aegis to Caelum. These planets are too far for a single laser
> hop, so the protocol relays it. You can see the chosen route on the map: Aegis → Dawn → Caelum."

**Do:** Open the **Codex Dialect Terminal** panel. Click hop tab #0 (Aegis).

**Say:**

> "This is the heart of the encoding requirement. Aegis works in base 8 internally, but before
> beaming across the void it re-encodes the payload into the _next_ hop's dialect — Dawn's base 6.
> The table shows each character: its ASCII value, the local dialect, and the conversion into the
> next hop's base. Below it is the actual flat binary stream that gets serialized and beamed across
> the vacuum."

**Do:** Click hop tab #1 (Dawn), then hop #2 (Caelum).

**Say:**

> "At Dawn, the packet is decoded back to ASCII for internal tower routing, then re-encoded into
> Caelum's base 14 before the next hop. And at Caelum — the final destination — there's no further
> hop; it decodes locally. You can see the base-14 digits here: 52, 73, 7A, and so on, exactly
> matching the challenge's worked example, where A represents 10."

**Do:** Point to the delivered payload / status.

**Say:**

> "The payload arrives perfectly intact: 'Hello world'. Importantly, this isn't faked — our engine
> actually runs the encode, serialize, deserialize, decode round-trip per hop, so this is a genuine
> proof of integrity. Every conversion is recorded in the packet's hop_log."

---

## 3. M3 — Latency Breakdown — (6:00–8:00)

**Do:** Point to the **Latency & Propagation Telemetry** panel.

**Say:**

> "Latency is computed from four distinct physical components, all in milliseconds. Subsurface fiber
> transit — data moving along a planet's equatorial ring at 0.67 times light speed. Processing tower
> delay — a fixed 7-millisecond penalty per distinct tower hit. Atmospheric refraction — the signal
> slowing as it pierces each planet's atmosphere, scaled by the refraction index. And void
> transmission — the laser crossing the vacuum at light speed."

**Do:** Point to the gauges and the total.

**Say:**

> "Here's the live breakdown for our route. As you'd expect over interplanetary distances, the void
> component dominates — it's by far the largest share. The tower and fiber components are tiny by
> comparison. The internal transit cost is turn-dependent — it depends on which tower the packet
> enters and exits — so our routing accounts for that precisely using a state-expanded shortest-path
> search, not a naive one."

---

## 4. M4 — Chaos Test — (8:00–10:30)

**Say:**

> "Finally, resilience. The Relic Ring is fragile, so the protocol must reroute around failures in
> real time."

**Do:** Click the **Distortion** scenario preset (or click the **Dawn** planet directly to kill it).

**Say:**

> "I'm taking Dawn offline — the planet our route was relaying through. Watch the system instantly
> recompute. The route now goes Aegis → Elysium → Caelum, completely avoiding the dead zone, and the
> payload still arrives intact as 'Hello world'. The latency increases, which makes sense — it's a
> longer detour."

**Do:** Click **Blackout** (or kill a second planet) to isolate the destination.

**Say:**

> "And if we sever enough of the network that the destination becomes unreachable, the protocol
> doesn't crash — it correctly reports the packet as undeliverable, with a clear reason. That's the
> difference between a robust protocol and a brittle one."

**Do:** Click **Reset** / **Baseline** to restore.

---

## 5. Wrap-up — (10:30–11:30)

**Do:** In the terminal, run `npm test`.

**Say:**

> "Under the hood, the engine is fully unit-tested — 72 tests covering the latency math, the routing
> algorithm, the codec including the challenge's exact base-5 and base-14 examples, and the
> resilience logic. The project is containerized with Docker, the configuration is fully dynamic
> with no hardcoded values, and the whole thing is documented in our README with justifications for
> every constant."

**Say:**

> "That's the Relic Ring Protocol: physically accurate latency, faithful dialect translation,
> lowest-latency routing under the Lmax constraint, and resilient rerouting around failures.
> Thanks for watching."

---

## Quick reference (expected values)

| Item                           | Value                                       |
| ------------------------------ | ------------------------------------------- |
| Default route (Aegis → Caelum) | `Aegis → Dawn → Caelum`                     |
| Route after killing Dawn       | `Aegis → Elysium → Caelum`                  |
| Payload                        | `Hello world` (intact end-to-end)           |
| Caelum base-14 digits          | `52 73 7A 7A 7D 24 87 7D 82 7A 72` (A = 10) |
| Dominant latency component     | Void transmission                           |
| Test count                     | 72 passing                                  |

## Milestone → evaluation criteria

- **M1 / M2** → Baseline Delivery (critical)
- **M3** → Latency Accuracy (high)
- **M4** → Resilience (high)
- Lmax + shortest path → Routing Efficiency (medium)

## Recording tips

- Give the dashboard a beat to update after each click (it auto-transmits).
- Large void latency numbers (hundreds of thousands of ms) are correct — interplanetary distances.
- M2 and M4 are the "money shots"; they map to the highest-weighted criteria.
