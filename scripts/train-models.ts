/**
 * Offline trainer for the three Chimera analytical sub-models.
 *
 * Owner: Ruwan (Phase 1 — sections 1.2–1.4)
 *
 * Fits all coefficients directly from the historical CSVs in `challenge p2/`
 * and writes the runtime `*.model.json` files consumed by the models at
 * request time. Pure TypeScript — no Python dependency — so the trained models
 * are fully reproducible with `npm run train:models`.
 *
 *   congestion.model.json  penalty = k * load_ratio^p        (per-link power law)
 *   trust.model.json       compromised link delta stats      (spoofing detector)
 *   targeting.model.json   P(jammed) = sigmoid(b0 + b1*share) (per-link logistic)
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadIncidentHistory } from "../src/lib/chimera/csv/load-incidents";
import { loadTelemetry } from "../src/lib/chimera/csv/load-telemetry";
import { loadTrafficHistory } from "../src/lib/chimera/csv/load-traffic";
import {
  computeDeltaStats,
  computeTv,
  fitLogistic,
  fitPowerLaw,
  isCompromised,
  loadTvUniverse,
  round,
  type DeltaStats,
} from "./model-utils";

const MODELS_DIR = join(process.cwd(), "src/lib/chimera/models");
const DATA_DIR = join(process.cwd(), "challenge p2");

/** Saturation threshold from DATASETS.md (SATURATION_LOAD_RATIO). */
const SATURATION_LOAD_RATIO = 0.9;

/** L2 ridge strength for the targeting logistic regression. */
const TARGETING_RIDGE = 1;

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function trainCongestion(): number {
  const universe = loadTvUniverse();
  const rows = loadTrafficHistory(join(DATA_DIR, "link_traffic_history.csv"));
  const byLink = groupBy(rows, (r) => r.link_id);

  const coeffs: Record<string, { k: number; p: number }> = {};
  for (const [linkId, linkRows] of byLink) {
    const [planetA, planetB] = linkId.split("-");
    const tv = computeTv(universe, planetA!, planetB!);
    const points = linkRows
      .filter(
        (r) =>
          r.status === "ok" &&
          r.observed_latency_ms !== null &&
          r.load_ratio > 0 &&
          r.load_ratio < SATURATION_LOAD_RATIO,
      )
      .map((r) => ({ ratio: r.load_ratio, penalty: r.observed_latency_ms! - tv }));

    const fit = fitPowerLaw(points);
    if (fit) {
      coeffs[linkId] = { k: round(fit.k, 3), p: round(fit.p, 3) };
    }
  }

  const sorted = Object.keys(coeffs)
    .sort()
    .reduce<Record<string, { k: number; p: number }>>((acc, key) => {
      acc[key] = coeffs[key]!;
      return acc;
    }, {});

  writeFileSync(
    join(MODELS_DIR, "congestion.model.json"),
    JSON.stringify(sorted, null, 2) + "\n",
    "utf8",
  );
  return Object.keys(sorted).length;
}

function trainTrust(): number {
  const rows = loadTelemetry(join(DATA_DIR, "link_telemetry.csv"));
  const deltasByLink = new Map<string, { deltas: number[]; measured: number[] }>();
  for (const r of rows) {
    // Empty self_reported cells (parsed as NaN) mark ticks the link went dark
    // under saturation; they carry no delta signal and are excluded from the
    // spoofing statistics.
    if (!Number.isFinite(r.self_reported_latency_ms)) continue;
    const bucket = deltasByLink.get(r.link_id) ?? { deltas: [], measured: [] };
    bucket.deltas.push(r.measured_latency_ms - r.self_reported_latency_ms);
    bucket.measured.push(r.measured_latency_ms);
    deltasByLink.set(r.link_id, bucket);
  }

  const stats = computeDeltaStats(deltasByLink);
  const compromised: Record<string, { mean_delta_ms: number; std_delta_ms: number }> =
    {};
  const sortedIds = [...stats.keys()].sort();
  for (const linkId of sortedIds) {
    const s = stats.get(linkId) as DeltaStats;
    if (isCompromised(s)) {
      compromised[linkId] = {
        mean_delta_ms: round(s.mean_delta_ms, 3),
        std_delta_ms: round(s.std_delta_ms, 3),
      };
    }
  }

  writeFileSync(
    join(MODELS_DIR, "trust.model.json"),
    JSON.stringify({ compromised_links: compromised }, null, 2) + "\n",
    "utf8",
  );
  return Object.keys(compromised).length;
}

function trainTargeting(): number {
  const rows = loadIncidentHistory(join(DATA_DIR, "link_incident_history.csv"));
  const byLink = groupBy(rows, (r) => r.link_id);

  const coeffs: Record<string, { b0: number; b1: number }> = {};
  for (const [linkId, linkRows] of byLink) {
    const points = linkRows.map((r) => ({
      x: r.traffic_share,
      y: r.jammed_flag ? 1 : 0,
    }));
    // Light L2 ridge on the slope: stabilises per-link coefficients and guards
    // against overfitting on links with few recorded jamming incidents.
    const fit = fitLogistic(points, { lambda: TARGETING_RIDGE });
    coeffs[linkId] = { b0: round(fit.b0, 5), b1: round(fit.b1, 5) };
  }

  const sorted = Object.keys(coeffs)
    .sort()
    .reduce<Record<string, { b0: number; b1: number }>>((acc, key) => {
      acc[key] = coeffs[key]!;
      return acc;
    }, {});

  writeFileSync(
    join(MODELS_DIR, "targeting.model.json"),
    JSON.stringify(sorted, null, 2) + "\n",
    "utf8",
  );
  return Object.keys(sorted).length;
}

function main(): void {
  console.log("Training Chimera analytical sub-models from challenge p2/ CSVs...");
  const congestion = trainCongestion();
  console.log(`  congestion.model.json  → ${congestion} per-link power laws`);
  const trust = trainTrust();
  console.log(`  trust.model.json       → ${trust} compromised links flagged`);
  const targeting = trainTargeting();
  console.log(`  targeting.model.json   → ${targeting} per-link logistic models`);
  console.log("Training complete.");
}

main();
