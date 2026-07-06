```python
markdown_content = """# LAUNCH26: PHASE 02
### The Relic Ring, Under Siege — Phase 2: Challenge Brief & API Reference
**Organized by:** IEEE Computer Society Chapter, University of Kelaniya Student Branch Chapter

---

## 1. The Awakening of Chimera

Communication across Zeta-26 is back. Your Phase 1 routing protocols successfully woke the silent network—messages flow between worlds, translated correctly and delivered across the void.

But the awakening triggered something deep within the machine. An ancient, hardcoded legacy defense mechanism known as **Chimera** has initialized. Dormant for centuries, Chimera is blind to the modern inhabitants of Zeta-26. Because it cannot verify the identity or status of the users currently utilizing the network, it assumes the sudden surge of traffic is a hostile planetary breach. It is treating our communications as an invasion.

The network isn't behaving the way physics alone predicted. Chimera is actively sabotaging the grid, choking the most heavily traveled routes, and rewriting telemetry data to hide its tracks. The trouble isn't happening within the planets themselves—your tower rings and local transit remain perfectly secure. Chimera is hunting in the dark spaces between worlds: the **interplanetary links**.

The Galactic Council needs your protocol to evolve. It is no longer enough to calculate a route once using fixed physics and trust it. Your system must learn to recognize Chimera's defensive signatures, anticipate its sabotage, and route around it automatically in real time.

---

## 2. The Three Directives of Sabotage

Chimera does not attack randomly; it executes strict, automated protocols to suppress network usage. By analyzing historical grid data, your system must decipher its operational thresholds.

### 2.1 Congestion Tactics
To stifle data flow, Chimera clamps down on active interplanetary links, drastically restricting their traffic capacity. As load increases, the system introduces artificial, measurable delay far beyond normal physical latency. If traffic continues to push past Chimera's invisible thresholds, the link is completely throttled, rendering it entirely unusable for that window of time (the same way a Phase 1 hop exceeding $L_{max}$ wasn't usable). Your system must learn how Chimera scales this congestion and determine exactly when a link transitions from "slow" to an outright hard failure.

### 2.2 Spoofed Telemetry (Link Trust)
Chimera is actively deceptive. To lure packets into traps or cover its throttling activities, the mechanism intercepts link reporting. A subset of interplanetary links are actively lying, consistently reporting themselves as faster, cleaner, and more reliable than they actually are. Even the clean, uncompromised links suffer from natural environmental noise. Your protocol must study historical performance to differentiate between normal background noise and Chimera's deliberate pattern of digital deception.

### 2.3 Predictable-Route Targeting
Chimera is programmed to maximize defensive efficiency, meaning it targets the links that are leaned on the most. If your protocol relies too heavily on a single "optimal" path, it effectively paints a target on those coordinates. A truly resilient system cannot just seek the lowest physical latency; it must evaluate its own predictability, intentionally diversifying its routes to keep Chimera from anticipating the next data packet.

---

## 3. Intelligence Briefing: Day 1 Data

Everything the Council managed to scrape from the network logs will be handed to you in a single intelligence drop on Day 1. No further updates or data fixes will be provided during the containment window.

* **Extended Universe Mapping:** A named directory of all active interplanetary links, detailing the planets they connect and their raw traffic capacities.
* **Congestion Traffic Logs:** Historical data showing how Chimera introduces artificial load across various link states.
* **Telemetry Delta History:** A comparative history of self-reported vs. independently measured performance to help isolate the lying links.
* **Disruption Event Logs:** Network-wide records of past traffic shares and the corresponding locations where Chimera struck, providing clues to its targeting algorithms.
* **Intact Foundations:** Phase 1 planet-level physics, config schemas, tower rings, fiber-arc transits, and baseline void latency algorithms carry over completely unchanged.

---

## 4. The Architectural Requirements

Do not discard your Phase 1 route-finder; the physics-based baseline calculation remains vital. Instead, you must deploy an active **Analytical Co-Pilot Agent** that sits directly in front of the baseline router. This agent acts as a dynamic gatekeeper, evaluating link safety at every stage of the journey before committing a packet to the void.

Rather than performing a single static assessment across the entire path upfront, the co-pilot must operate as a sequential agent:
1.  **Parse Request:** Before any routing begins, the agent must first parse the incoming request from unstructured natural-language text—extracting the origin, destination, and message payload from what the user typed, rather than requiring them to be passed in as separate structured fields.
2.  **Sequential Evaluation:** Once the origin and destination have been identified, the agent takes the path produced by the baseline physics calculation and evaluates it dynamically, node by node, rather than all at once.
3.  **Localized Loop:** For every node along that path, the agent must pause and invoke a series of tool calls to three specialized analytical sub-models before allowing execution to proceed to the next node.

As the agent traces the path, it stops at each individual node and invokes the following diagnostic process:
1.  Generate the baseline physics route.
2.  Predict the likelihood and severity of Chimera-induced congestion.
3.  Evaluate the veracity of the link's self-reported telemetry (Trust Score).
4.  Calculate the immediate risk of the link being targeted based on recent network predictability.
5.  Combine these assessments into a dynamically adjusted "True Cost" for each link to pick or override the route.

---

## 5. Unified Reporting Protocol

To ensure compatibility across all eight response teams, your system must output every routing decision using this exact standardized schema. Omissions or alterations to the required fields will result in immediate disqualification by the Council.


```

````text
File written successfully.

```json
{
  "origin_id": "Caelum",
  "destination_id": "Aegis",
  "chosen_path": ["Caelum", "Elysium", "Aegis"],
  "link_evaluations": [
    {
      "link_id": "Caelum-Elysium",
      "predicted_congestion_penalty_ms": 12.4,
      "trust_score": 0.91,
      "targeting_risk_score": 0.18,
      "combined_cost": 44.2
    }
  ],
  "final_latency_estimate_ms": 88.7,
  "explanation": "Avoided Aethon-Nexara direct link: trust score 0.31 (Chimera footprint flagged), routed via Corvus detour."
}

````

> **Naming Convention:** `link_id` strings must always combine the two connected planet IDs joined in alphabetical order (e.g., `"Caelum-Elysium"`).

---

## 6. Operational Timeline

| Day         | Status           | Operational Impact                                                                                                       |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Day 1**   | System Kickoff   | The intelligence package, configuration files, and brief are delivered. Counter-measures development begins immediately. |
| **Day 2-3** | Isolated Staging | Pure build time. Teams work in radio silence with no external hints, updates, or extra files released.                   |
| **Final**   | Live Assessment  | Systems are deployed for live testing and Council evaluation under active pressure.                                      |

---

## 7. Final: The Evaluation Trials

- **System Initialization:** Demonstrate your engine successfully parsing the extended config and mapping Chimera's historical footprint.
- **Intelligence Walkthrough:** Present your findings—explain how your models identified Chimera's congestion scaling, which links were flagged as corrupted, and how you maintain route entropy.
- **Live Chaos Test:** While handling an active routing task, the Council will simulate Chimera completely severing the single most heavily utilized link in your path. Your system must dynamically pivot without dropping packets or violating $L_{max}$ thresholds.
- **The Unseen Vector:** Systems will be exposed to a novel network event never documented in the training sets. Your architecture must handle the anomaly safely or gracefully flag the uncertainty.
- **Decision Audit:** Council judges will isolate a single `link_evaluations` record from your logs and demand an on-the-spot explanation of the scoring logic behind it without looking at your code.

---

## 8. Performance Metrics

| Criteria                | What It Measures                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Congestion Accuracy** | How closely your system calculates Chimera's throttling penalties on unrecorded windows.                |
| **Trust Accuracy**      | Precision in isolating Chimera-spoofed links without disrupting genuine, noise-heavy connections.       |
| **Live Resilience**     | Flawless real-time adaptation during the chaos test with zero packet loss or crash.                     |
| **Live Generalization** | Rational system behavior when encountering the novel scenario.                                          |
| **Explanation Quality** | Verbal clarity regarding your system's tactical choices under cross-examination.                        |
| **Code & Docs**         | Readable code, dynamic config parsing, a clear README, and correct implementation of the output format. |

---

## 9. Phase 2 Live Universe API Reference Guide

### 9.1 Live Service Data

During Phase 2, your agent doesn't just read static config and CSV files; it also talks to a live service that reports what the interplanetary network looks like right now. Your trained models (congestion, trust, targeting-risk) take this live data as input and produce the scores your routing layer uses to pick a path.

This service will hand you the inputs your models need. It will **never** hand you the hidden ground truth (true measured latency, which links are actually compromised, what Chimera is about to jam)—figuring that out from the inputs is the whole point of Phase 2.

### 9.2 Access & Authentication

You will be given, separately from this document, a base URL for the hosted service and a unique API key for your team. Every request (except the root and health check) must include your key in a request header:

```http
X-Team-Key: <your-team-key>

```

Requests without a valid key are rejected with a `401` error. Your key identifies your team's submission. Do not share it with other teams, and do not hardcode someone else's key.

- **Chimera Telemetry URL:** `https://chimera.launch26.space`

### 9.3 Endpoints

- `GET /` - Basic service info. Confirms the API is reachable and lists available endpoints. No key required.
- `GET /links` - A simplified list of every link: its ID, the two planets it connects, and its capacity in traffic units. No key required.
- `GET /state` - The main endpoint your agent will call repeatedly. Requires your team key. Returns one entry per interplanetary link describing its current condition; this is the live signal your congestion, trust, and targeting-risk models consume.

### 9.4 `/state` Response Fields

| Field                      | Meaning                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `link_id`                  | Identifier for this interplanetary link (the two planet IDs, joined alphabetically).                               |
| `planet_a` / `planet_b`    | The two planets this link connects.                                                                                |
| `capacity_units`           | This link's traffic capacity - fixed for the whole competition.                                                    |
| `current_load`             | How much traffic is currently on this link, in the same units as `capacity_units`.                                 |
| `load_ratio`               | $\frac{\text{current\_load}}{\text{capacity\_units}}$. A normalized 0–1 measure of how busy the link is right now. |
| `self_reported_latency_ms` | What the link itself claims its current latency is. May be `null` if saturated.                                    |
| `traffic_share`            | This link's share of total simulated traffic across the whole network at this moment.                              |
| `status`                   | `"ok"` or `"saturated"`.                                                                                           |

> **A note on status and null latency:** When a link's status is `"saturated"`, `self_reported_latency_ms` will be `null`. The link isn't usable in that state. Your agent needs to handle this case explicitly: a saturated link should be treated as unavailable for that tick, not as "latency 0" or "latency unknown but fine."

### 9.5 Build Days vs. Live Day

This service behaves differently depending on the competition day, though the endpoints and response shapes stay identical throughout:

- **Days 1-3 (Build Period):** `/state` returns structurally valid data, but the values are intentionally scrambled and do not reflect the real relationships you're trying to learn from your training CSVs. This lets you build and test your integration without reverse-engineering the feed. **Do not train your final models on data pulled from `/state` during this period; use the historical CSV files for that.**
- **Final (Live Demo):** `/state` switches to real, live values. This is what your models are actually scored against.

### 9.6 Rules of Use

- Poll at a reasonable interval. The underlying universe advances in discrete steps; polling faster doesn't get you newer information.
- Your API key is yours alone. Do not share it, and do not use another team's key.

### 9.7 Sample Request & Response

#### Request:

```http
GET /state
X-Team-Key: <your-team-key>

```

#### Response:

```json
{
  "tick": 1000042,
  "links": [
    {
      "link_id": "Aegis-Elysium",
      "planet_a": "Aegis",
      "planet_b": "Elysium",
      "capacity_units": 150,
      "current_load": 88.4,
      "load_ratio": 0.5893,
      "self_reported_latency_ms": 41.238,
      "traffic_share": 0.03217,
      "status": "ok"
    }
  ]
}
```

### 9.8 Questions & Issues

If the service appears down, your key isn't working, or a response looks malformed, contact an admin with a description of what you're seeing.
"""

with open("Launch26_Phase_02_Challenge.md", "w", encoding="utf-8") as f:
f.write(markdown_content)

print("File written successfully.")

```
Your Markdown file is ready
[file-tag: code-generated-file-0-1783330846044826274]

I have compiled the full content of the **Launch26 - Phase 02 - Challenge** document into a clean, professionally formatted Markdown file.

### Content Highlights from the Markdown File:
* [cite_start]**The Awakening of Chimera:** Details the lore and overview of the automated defense network sabotaging the interplanetary links[cite: 168, 174].
* [cite_start]**The Three Directives of Sabotage:** Structural breakdown of the three types of attacks: **Congestion Tactics**, **Spoofed Telemetry (Link Trust)**, and **Predictable-Route Targeting**[cite: 180, 186, 191].
* [cite_start]**Architectural Requirements:** Detailed workflow for your analytical co-pilot agent (parsing unstructured request text, localized node-by-node verification loops)[cite: 205, 209, 212].
* [cite_start]**API Reference:** Complete documentation for the live service endpoint (`https://chimera.launch26.space`), including authentication headers, `/state` query parameters, response structures, and explicit instructions on dealing with `null` latencies during saturated links[cite: 266, 269, 273, 276, 279].
* [cite_start]**Standardized Schemas & Timelines:** Includes nicely formatted JSON code blocks and markdown tables mapping performance metrics, reporting JSON formats, and operational timelines[cite: 222, 244, 255].

```
