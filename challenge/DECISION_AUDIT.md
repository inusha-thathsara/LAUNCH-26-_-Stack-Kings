# Decision Audit Cheat Sheet

> One-page reference for the Council's **Decision Audit** trial. For any single
> `link_evaluations` record, explain each score in plain English **without
> reading code**. Every formula below is implemented in `src/lib/chimera/`.

---

## The report record

Each hop on the chosen path emits one `LinkEvaluation`:

```json
{
  "link_id": "Aegis-Boreas",
  "predicted_congestion_penalty_ms": 1234.5,
  "trust_score": 0.92,
  "targeting_risk_score": 0.15,
  "combined_cost": 60123.4
}
```

The router picks the path that minimises the sum of `combined_cost` across hops
(with a diversification tie-break), never using a saturated or spoofed link.

---

## 1. `predicted_congestion_penalty_ms` — "How much extra delay from traffic?"

**Plain English:** Extra milliseconds Chimera congestion adds _on top of_ the
physics travel time, based on how loaded the link is right now.

**Formula (per link):**

\[
\text{penalty\_ms} = k \cdot (\text{load\_ratio})^{p}
\]

- `k`, `p` are per-link coefficients fitted from `link_traffic_history.csv`
  (global fallback `k = 600000`, `p = 2.25`).
- **Saturation guard:** if `status = "saturated"`, `self_reported_latency_ms =
null`, or `load_ratio ≥ 0.90` → link is **unavailable** (penalty 0, blocked).

**Talking point:** "Load ratio is 0.15, so congestion is mild — the power-law
gives ~X ms. If it had crossed 0.90 we'd have dropped the link entirely."

---

## 2. `trust_score` — "Can we believe the link's self-reported latency?"

**Plain English:** 0–1 confidence that the link is telling the truth about its
latency. Low means Chimera is spoofing (claiming it's faster than physics
allows).

**How it's computed:**

1. Expected honest latency = physics baseline `Tv` + congestion penalty.
2. `liveDelta = expected − self_reported`. A large positive delta = the link
   claims to be much faster than possible = spoofing.
3. **Known compromised links** (from `link_telemetry.csv`): `trust = 1 −
(liveDelta / mean_spoof_delta)`, clamped to [0, 1].
4. **Historically honest links (Unseen Vector):** if `liveDelta > 15000 ms`,
   trust drops linearly to 0 across the next 30000 ms.

- **Trust floor = 0.5.** Below this the link is **hard-blocked** and the
  Co-Pilot reroutes around it.
- Known spoofed links: **Aegis-Elysium**, **Boreas-Fenix**.

**Talking point:** "Trust 0.92 means the reported latency matches physics — no
spoofing. Aegis-Elysium usually reads ~0.1 because it under-reports by ~78s."

---

## 3. `targeting_risk_score` — "How likely will Chimera jam this link?"

**Plain English:** 0–1 probability Chimera targets this link, driven by how much
of the network's traffic flows through it (predictable = paintable target).

**Formula (per-link logistic regression on `traffic_share`):**

\[
P(\text{jammed}) = \frac{1}{1 + e^{-(b_0 + b_1 \cdot \text{traffic\_share})}}
\]

- `b0`, `b1` fitted from `link_incident_history.csv` (global fallback
  `b0 = −2.73647`, `b1 = 3.61594`).
- Higher traffic share → higher jam probability → drives **route entropy**.

**Talking point:** "Targeting 0.15 is low because this link carries little
traffic. If everyone funnels through one link, its share rises and Chimera jams
it — so we diversify."

---

## 4. `combined_cost` — "The single number the router minimises"

**Plain English:** Physics time plus all penalties, minus a small bonus for
using quiet links. The router's Dijkstra minimises the sum of this over a path.

**Formula:**

\[
\text{combined\_cost} = \text{physics\_void\_ms}

- \text{congestion\_penalty}
- \underbrace{(1 - \text{trust}) \cdot 80000}_{\text{trust penalty}}
- \underbrace{\text{targeting\_risk} \cdot 50000}_{\text{targeting penalty}}

* \underbrace{\text{traffic\_share} \cdot 25000}_{\text{entropy bonus}}
  \]

Scale constants (`src/lib/chimera/constants.ts`):

| Term                    | Constant                 | Value     |
| ----------------------- | ------------------------ | --------- |
| Trust penalty scale     | `TRUST_SCALE_MS`         | 80,000 ms |
| Targeting penalty scale | `TARGETING_SCALE_MS`     | 50,000 ms |
| Entropy bonus scale     | `ENTROPY_BONUS_SCALE_MS` | 25,000 ms |

**Talking point:** "Combined cost translates trust and jam risk into
millisecond-equivalents so one Dijkstra can weigh latency against safety."

---

## 5. Route diversification (entropy tie-break)

Among paths whose total True Cost is within **ε = 5%**
(`ROUTE_DIVERSIFICATION_EPSILON`) of the optimum, we pick the one with the
**lowest aggregate targeting risk**. This stops us from always painting the same
predictable target.

---

## 6. Unseen-vector / anomaly handling (Phase 5)

If live telemetry is **out-of-distribution** (NaN, negative, load/traffic
outside [0, 1], unknown status), `detectLinkAnomaly`:

1. **Sanitises** every field into its valid range → models never emit NaN, never
   crash, and the mandatory report schema always validates.
2. Applies **conservative scores**: `trust ≤ 0.3`, `targeting ≥ 0.85`.
3. Adds to the `explanation`: _"Anomaly detected on link X; routing
   conservatively."_

Anomalous links are **not** hard-blocked on trust alone (to preserve
deliverability) but their inflated `combined_cost` steers the router away when a
safer path exists.

**Talking point:** "If Chimera sends garbage telemetry, we don't crash and we
don't trust it — we clamp it, assume the worst, and route around it."

---

## Quick numbers to memorise

| Thing                              | Value                       |
| ---------------------------------- | --------------------------- |
| Trust floor (block below)          | 0.5                         |
| Saturation load ratio              | ≥ 0.90                      |
| Unseen-vector delta trigger        | > 15,000 ms                 |
| Trust / targeting / entropy scales | 80k / 50k / 25k ms          |
| Diversification ε                  | 5%                          |
| Conservative anomaly scores        | trust 0.3 · targeting 0.85  |
| Known spoofed links                | Aegis-Elysium, Boreas-Fenix |
