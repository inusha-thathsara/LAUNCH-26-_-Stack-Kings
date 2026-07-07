/**
 * Offline evaluator for the three Chimera analytical sub-models.
 *
 * Owner: Ruwan (Phase 1 — section 1.5)
 *
 * Scores the committed `*.model.json` models against the historical CSVs and
 * writes `challenge/INTELLIGENCE_REPORT.md` (the mandatory "Intelligence
 * Walkthrough" artifact). Run with `npm run evaluate:models` after
 * `npm run train:models`.
 *
 * Metrics:
 *   Congestion  — mean absolute error (ms) of the penalty prediction
 *   Trust       — precision / recall / F1 of spoof detection (threshold 0.5)
 *   Targeting   — average cross-entropy (log loss) of P(jammed)
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadIncidentHistory } from "../src/lib/chimera/csv/load-incidents";
import { loadTelemetry } from "../src/lib/chimera/csv/load-telemetry";
import { loadTrafficHistory } from "../src/lib/chimera/csv/load-traffic";
import trustModel from "../src/lib/chimera/models/trust.model.json";
import congestionModel from "../src/lib/chimera/models/congestion.model.json";
import { predictCongestion } from "../src/lib/chimera/models/congestion";
import { scoreTrust } from "../src/lib/chimera/models/trust";
import { scoreTargetingRisk } from "../src/lib/chimera/models/targeting";
import type { ChimeraLinkState } from "../src/lib/chimera/types";
import { computeTv, loadTvUniverse } from "./model-utils";

const DATA_DIR = join(process.cwd(), "challenge p2");
const REPORT_DIR = join(process.cwd(), "challenge");
const SATURATION_LOAD_RATIO = 0.9;
const TRUST_THRESHOLD = 0.5;

const universe = loadTvUniverse();
const congestionCoeffs = congestionModel as Record<string, { k: number; p: number }>;
const compromisedLinks = new Set(Object.keys(trustModel.compromised_links));

function tvFor(linkId: string): number {
  const [a, b] = linkId.split("-");
  return computeTv(universe, a!, b!);
}

function stateFor(
  overrides: Partial<ChimeraLinkState> & { link_id: string },
): ChimeraLinkState {
  const [planet_a, planet_b] = overrides.link_id.split("-");
  return {
    planet_a: planet_a!,
    planet_b: planet_b!,
    capacity_units: 100,
    current_load: 0,
    load_ratio: 0,
    self_reported_latency_ms: 0,
    traffic_share: 0,
    status: "ok",
    ...overrides,
  };
}

interface CongestionResult {
  globalMae: number;
  count: number;
  perLink: Array<{ linkId: string; mae: number; count: number }>;
}

function evaluateCongestion(): CongestionResult {
  const rows = loadTrafficHistory(join(DATA_DIR, "link_traffic_history.csv"));
  const perLink = new Map<string, { sum: number; count: number }>();
  let totalError = 0;
  let count = 0;

  for (const row of rows) {
    if (
      row.status !== "ok" ||
      row.observed_latency_ms === null ||
      row.load_ratio >= SATURATION_LOAD_RATIO
    ) {
      continue;
    }
    const tv = tvFor(row.link_id);
    const actualPenalty = row.observed_latency_ms - tv;
    const prediction = predictCongestion(
      stateFor({
        link_id: row.link_id,
        load_ratio: row.load_ratio,
        self_reported_latency_ms: row.observed_latency_ms,
      }),
      tv,
    );
    const error = Math.abs(actualPenalty - prediction.penalty_ms);
    totalError += error;
    count += 1;
    const bucket = perLink.get(row.link_id) ?? { sum: 0, count: 0 };
    bucket.sum += error;
    bucket.count += 1;
    perLink.set(row.link_id, bucket);
  }

  return {
    globalMae: count > 0 ? totalError / count : 0,
    count,
    perLink: [...perLink.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([linkId, s]) => ({ linkId, mae: s.sum / s.count, count: s.count })),
  };
}

interface TrustResult {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
}

function evaluateTrust(): TrustResult {
  const rows = loadTelemetry(join(DATA_DIR, "link_telemetry.csv"));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.self_reported_latency_ms)) continue;
    const tv = tvFor(row.link_id);
    const coeffs = congestionCoeffs[row.link_id];
    // Reconstruct load_ratio from ground-truth measured latency so scoreTrust
    // sees a realistic operating point: measured = tv + k * ratio^p.
    const measuredPenalty = Math.max(0, row.measured_latency_ms - tv);
    const reconstructedRatio = coeffs
      ? Math.min(0.89, Math.pow(measuredPenalty / coeffs.k, 1 / coeffs.p))
      : 0;

    const trust = scoreTrust(
      stateFor({
        link_id: row.link_id,
        load_ratio: reconstructedRatio,
        self_reported_latency_ms: row.self_reported_latency_ms,
      }),
    );
    const predictedSpoofed = trust < TRUST_THRESHOLD;
    const actuallyCompromised = compromisedLinks.has(row.link_id);

    if (actuallyCompromised && predictedSpoofed) tp += 1;
    else if (!actuallyCompromised && predictedSpoofed) fp += 1;
    else if (actuallyCompromised && !predictedSpoofed) fn += 1;
    else tn += 1;
  }

  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);
  return { tp, fp, fn, tn, precision, recall, f1 };
}

interface TargetingResult {
  avgLogLoss: number;
  avgJammedPred: number;
  avgCleanPred: number;
}

function evaluateTargeting(): TargetingResult {
  const rows = loadIncidentHistory(join(DATA_DIR, "link_incident_history.csv"));
  let logLoss = 0;
  let count = 0;
  let jammedSum = 0;
  let jammedCount = 0;
  let cleanSum = 0;
  let cleanCount = 0;

  for (const row of rows) {
    const pred = scoreTargetingRisk(
      stateFor({ link_id: row.link_id, traffic_share: row.traffic_share }),
    );
    const actual = row.jammed_flag ? 1 : 0;
    logLoss +=
      -actual * Math.log(Math.max(1e-15, pred)) -
      (1 - actual) * Math.log(Math.max(1e-15, 1 - pred));
    count += 1;
    if (row.jammed_flag) {
      jammedSum += pred;
      jammedCount += 1;
    } else {
      cleanSum += pred;
      cleanCount += 1;
    }
  }

  return {
    avgLogLoss: count > 0 ? logLoss / count : 0,
    avgJammedPred: jammedCount > 0 ? jammedSum / jammedCount : 0,
    avgCleanPred: cleanCount > 0 ? cleanSum / cleanCount : 0,
  };
}

function buildReport(
  congestion: CongestionResult,
  trust: TrustResult,
  targeting: TargetingResult,
): string {
  const perLinkRows = congestion.perLink
    .map((l) => `| ${l.linkId} | ${l.mae.toFixed(3)} | ${l.count} |`)
    .join("\n");

  const compromisedList = Object.entries(trustModel.compromised_links)
    .map(([linkId, info], i) => {
      const under = (info.mean_delta_ms / 1000).toFixed(1);
      return `${i + 1}. **${linkId}:** systematic under-reporting (mean delta ~${under}s, std ~${(info.std_delta_ms / 1000).toFixed(1)}s).`;
    })
    .join("\n");

  return `# Chimera Intelligence Report (Phase 1 Model Evaluation)

This report documents the performance metrics and findings of the trained link-intelligence models. Coefficients are produced by \`npm run train:models\` and this report by \`npm run evaluate:models\`, both driven purely by the historical datasets in \`challenge p2/\`.

---

## 1. Congestion Model (MAE Performance)

The Congestion model uses a per-link power-law regression of Chimera-induced latency penalty against live link load ratio:
$$\\text{penalty\\_ms} = k \\cdot (\\text{load\\_ratio})^p$$

- **Global Mean Absolute Error (MAE):** **${congestion.globalMae.toFixed(3)} ms** (~${(congestion.globalMae / 1000).toFixed(3)}s average prediction offset)
- **Evaluation Count:** ${congestion.count} ticks (non-saturated \`ok\` rows)

### Per-Link MAE Breakdown:

| Link ID | MAE (ms) | Data Count |
| ------- | -------- | ---------- |
${perLinkRows}

---

## 2. Trust Model Spoofing Detection Accuracy

The Trust model compares each link's self-reported latency against the physics + congestion baseline and flags systematic under-reporting. A link is treated as spoofed when its trust score falls below \`${TRUST_THRESHOLD}\`.

### Performance Matrix (per-tick):

- **True Positives (TP):** ${trust.tp}
- **False Positives (FP):** ${trust.fp}
- **False Negatives (FN):** ${trust.fn}
- **True Negatives (TN):** ${trust.tn}

### Accuracy Metrics:

- **Precision:** **${(trust.precision * 100).toFixed(2)}%**
- **Recall:** **${(trust.recall * 100).toFixed(2)}%**
- **F1 Score:** **${trust.f1.toFixed(4)}**

### Compromised Link Map:

Telemetry delta analysis confirms the following link(s) are actively spoofing (self-reporting faster than reality):

${compromisedList}

---

## 3. Targeting Risk Model Performance

The Targeting Risk model estimates the probability of Chimera jamming a link using an L2-regularized per-link logistic regression on \`traffic_share\`:
$$P(\\text{jammed}) = \\frac{1}{1 + e^{-(b_0 + b_1 \\cdot \\text{traffic\\_share})}}$$

- **Average Log Loss (Cross-Entropy):** **${targeting.avgLogLoss.toFixed(5)}**
- **Average P(jammed) on jammed ticks:** **${(targeting.avgJammedPred * 100).toFixed(2)}%**
- **Average P(jammed) on clean ticks:** **${(targeting.avgCleanPred * 100).toFixed(2)}%**

### Summary of Targeting Tendencies:

As a link's traffic share rises, Chimera is increasingly likely to jam it. This is the core signal for enforcing **route entropy** — diversifying away from the single most-predictable path so the co-pilot does not paint a target on any one link.
`;
}

function main(): void {
  console.log("Evaluating Chimera analytical sub-models against challenge p2/ CSVs...");
  const congestion = evaluateCongestion();
  const trust = evaluateTrust();
  const targeting = evaluateTargeting();

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }
  const reportPath = join(REPORT_DIR, "INTELLIGENCE_REPORT.md");
  writeFileSync(reportPath, buildReport(congestion, trust, targeting), "utf8");

  console.log(`  congestion global MAE : ${congestion.globalMae.toFixed(3)} ms`);
  console.log(
    `  trust P/R/F1          : ${(trust.precision * 100).toFixed(1)}% / ${(trust.recall * 100).toFixed(1)}% / ${trust.f1.toFixed(3)}`,
  );
  console.log(`  targeting log loss    : ${targeting.avgLogLoss.toFixed(5)}`);
  console.log(`Report written to: ${reportPath}`);
}

main();
