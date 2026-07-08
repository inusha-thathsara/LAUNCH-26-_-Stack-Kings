# Chimera Co-Pilot — Phase 2 Demo Script

**Team:** Stack Kings · **Event:** LAUNCH 26 · **Target length:** ~10–12 min

Covers the five Phase 2 evaluation trials: **System Init**, **Intelligence
Walkthrough**, **Live NL Route**, **Chaos Severance Pivot**, **Decision Audit**.

> Phase 1 (Relic Ring physics routing) is covered separately in
> [`challenge p1/DEMO_SCRIPT.md`](challenge%20p1/DEMO_SCRIPT.md). This script
> assumes that baseline and focuses on the Chimera Co-Pilot layer.

## Before recording

- Dependencies installed (`npm install` — includes `zod`).
- `.env` has a valid `CHIMERA_TEAM_KEY` (server-side only, never committed).
- Dev server running: `npm run dev`, browser at `http://localhost:3000/relic`.
- Optional: `ollama serve` with `qwen3:4b` pulled for the LLM NL fallback (the
  rules parser handles the scripted utterances without it).
- Do one dry run — the Co-Pilot calls the live Chimera `/state`, so pause a beat
  after each click.

---

## 0. Intro — (0:00–1:00)

**Say:**

> "We're team Stack Kings. In Phase 1 we built the Relic Ring physics router. In
> Phase 2, an adversary — Chimera — sabotages the interplanetary links with
> congestion, spoofed telemetry, and predictable-route targeting. We kept the
> physics baseline and added an **Analytical Co-Pilot**: three trained models, a
> True Cost router, a sequential agent, and a natural-language interface — all
> emitting the Council's mandatory routing report schema."

---

## 1. System Init — (1:00–2:30)

**Do:** Open `challenge p2/universe-config.json` (12 interplanetary links with
`capacity_units`). Then hit `GET /api/health`.

**Say:**

> "The extended config loads twelve interplanetary links with capacities. Our
> health endpoint confirms the three models are loaded, Chimera is reachable,
> and reports the last simulation tick we observed from `/state`."

**Show:** `models_loaded: true`, `chimera_reachable: true`, `last_tick`.

---

## 2. Intelligence Walkthrough — (2:30–4:30)

**Do:** On `/relic`, point to the **Intelligence Walkthrough** panel. Optionally
open `challenge/INTELLIGENCE_REPORT.md`.

**Say (three findings):**

> "One — **congestion** is a per-link power-law on load ratio; global MAE ~22
> seconds. Two — **trust**: we detected two links systematically under-reporting
> latency — **Aegis-Elysium** and **Boreas-Fenix** — at 92% precision. Three —
> **targeting**: the more traffic a link carries, the more likely Chimera jams
> it, which is why we diversify routes to spread entropy."

---

## 3. Live NL Route — (4:30–6:30)

**Do:** In the **Co-Pilot Natural Language** box type:
`Send Hello world from Aegis to Caelum`.

**Before clicking route**, point at the **Parsed intent (preview)** chip — it should
already show `Aegis → Caelum` and `payload: "Hello world"` as you type.

Click **Route with Co-Pilot**. Then click **Initiate Void Beam** — when a routing
report is present, transmission follows the Co-Pilot `chosen_path` (not just the
physics baseline).

**Say:**

> "The hybrid parser extracts origin, destination, and payload — you see the
> structured intent **before** we route. The agent pulls live link state, evaluates
> each hop sequentially with all three models, and emits the Council schema — chosen
> path, per-link evaluations, a final latency estimate, and a plain-English
> explanation. When we beam the packet, it travels the Co-Pilot path so the hop_log
> proves intelligent routing end-to-end."

**Show:**

- **Parsed intent** chip (preview before route; confirmed after).
- **Map overlays**: links coloured by trust (red→green), dashed = blocked,
  pulsing = high targeting risk.
- **Baseline vs Co-Pilot** path toggle on the map.
- **Link Evaluations** table — click a row to expand the **decision audit**
  breakdown.
- **Co-Pilot Explanation** text.
- **Codex Terminal** after **Initiate Void Beam** — hop_log matches the chosen path.

---

## 4. Chaos Severance Pivot — (6:30–8:30)

**Do:** Turn on **Live Chaos Monitor** (top of the Co-Pilot controls). It
re-polls the Co-Pilot every few seconds. Trigger a scenario (e.g. **Hyper-Flare**
or sever the busiest link) to force a saturation mid-session.

**Say:**

> "With the live monitor on, the Co-Pilot re-polls Chimera `/state` and re-runs
> its sequential evaluation. When a link on the chosen path saturates, it blocks
> that hop and reroutes — and the dashboard animates the path change without a
> reload. We surface a **pivot banner** showing the old path giving way to the
> new one. Zero packet loss: the new path is chosen before the next send — and
> **Initiate Void Beam** will follow the updated Co-Pilot path automatically."

**Show:** The `pivot-notice` banner and the map path animating to the detour.

---

## 5. Decision Audit Drill — (8:30–10:30)

**Do:** Click a single row in the **Link Evaluations** table to expand its audit
breakdown. Keep `challenge/DECISION_AUDIT.md` handy.

**Say (for the selected link):**

> "Congestion penalty is `k · load_ratio^p` — extra delay from live traffic.
> Trust compares self-reported latency to physics-plus-congestion; below 0.5 we
> hard-block. Targeting risk is a logistic on traffic share. Combined cost folds
> all three into millisecond-equivalents plus an entropy bonus, and that's the
> single number Dijkstra minimises."

**Bonus — Unseen Vector:**

> "If Chimera feeds us out-of-distribution telemetry, we sanitise every field so
> the models never crash or emit NaN, assume the worst — low trust, high risk —
> and the explanation flags: _anomaly detected; routing conservatively._"

---

## Close — (10:30–11:00)

**Say:**

> "That's the Chimera Co-Pilot: physics-honest routing, three trained
> intelligence models, live adversary integration, natural-language control, and
> a fully-audited decision at every hop — all schema-valid, rate-limited, and
> unit- plus E2E-tested. Thanks, Council."

---

## Fallbacks if something breaks

| Problem                        | Fallback                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Chimera `/state` down          | Co-Pilot falls back to neutral link state; explanation notes it               |
| LLM/Ollama offline             | Rules parser handles the scripted utterances                                  |
| Live monitor noisy             | Toggle it off and route manually to show the pivot                            |
| Rate limited (429)             | Wait a moment; limit is 120 req/min per client                                |
| Co-Pilot path severed manually | Transmit falls back to physics baseline; `transmitted_on_copilot_path: false` |
