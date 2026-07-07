/**
 * Shared training/evaluation utilities for the Chimera analytical sub-models.
 *
 * Owner: Ruwan (Phase 1). These pure helpers are used by both
 * `train-models.ts` (fits coefficients and writes the *.model.json files) and
 * `evaluate-models.ts` (scores the committed models offline). Keeping the math
 * in one place guarantees the training and evaluation pipelines agree on the
 * physics baseline (Tv) and the fitting methods.
 *
 * No Python dependency: everything is fit in TypeScript so the coefficients are
 * fully reproducible from the historical CSVs shipped in `challenge p2/`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal planet shape needed for the void-latency (Tv) baseline. */
export interface TvNode {
  id: string;
  x: number;
  y: number;
  atmosphere_thickness_km: number;
  refraction_index: number;
}

/** Minimal metadata shape needed for the void-latency (Tv) baseline. */
export interface TvMetadata {
  coordinate_scale_unit_km: number;
  speed_of_light_kms: number;
}

/**
 * Resolve the active universe config path using the same precedence as the
 * runtime server loader (env override → Phase 2 → Phase 1 → repo root).
 */
export function resolveUniverseConfigPath(): string {
  const override = process.env.UNIVERSE_CONFIG_PATH;
  if (override && override.trim().length > 0) {
    return override;
  }
  const candidates = [
    join(process.cwd(), "challenge p2/universe-config.json"),
    join(process.cwd(), "challenge p1/universe-config.json"),
    join(process.cwd(), "universe-config.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(process.cwd(), "universe-config.json");
}

/** A loaded universe with fast id → node lookup for Tv computation. */
export interface TvUniverse {
  metadata: TvMetadata;
  nodesById: Map<string, TvNode>;
}

/** Read the universe config once and index its nodes by id. */
export function loadTvUniverse(configPath = resolveUniverseConfigPath()): TvUniverse {
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  const metadata = parsed.universe_metadata as TvMetadata;
  const nodes = parsed.nodes as TvNode[];
  const nodesById = new Map<string, TvNode>();
  for (const node of nodes) {
    nodesById.set(node.id, node);
  }
  return { metadata, nodesById };
}

/**
 * Physics baseline void latency Tv (ms) between two planets.
 *
 * Tv = (S / C) * 1000 + ((h_a * n_a + h_b * n_b) / C) * 1000
 * where S is the scaled center-to-center distance. This matches the definition
 * the historical CSV penalties were generated against (center-based), so the
 * fitted congestion penalty is exactly `observed_latency_ms - Tv`.
 */
export function computeTv(
  universe: TvUniverse,
  planetA: string,
  planetB: string,
): number {
  const nodeA = universe.nodesById.get(planetA);
  const nodeB = universe.nodesById.get(planetB);
  if (!nodeA || !nodeB) {
    throw new Error(`computeTv: unknown planet(s) ${planetA} / ${planetB}`);
  }
  const scale = universe.metadata.coordinate_scale_unit_km;
  const c = universe.metadata.speed_of_light_kms;
  const dx = (nodeA.x - nodeB.x) * scale;
  const dy = (nodeA.y - nodeB.y) * scale;
  const distanceKm = Math.sqrt(dx * dx + dy * dy);
  const refractDist =
    nodeA.atmosphere_thickness_km * nodeA.refraction_index +
    nodeB.atmosphere_thickness_km * nodeB.refraction_index;
  const atmosphereMs = (refractDist / c) * 1000;
  const voidMs = (distanceKm / c) * 1000;
  return atmosphereMs + voidMs;
}

/** Coefficients for the per-link power-law congestion model. */
export interface PowerLawFit {
  k: number;
  p: number;
}

/**
 * Fit `penalty = k * load_ratio^p` via ordinary least squares on the log-log
 * transform: log(penalty) = log(k) + p * log(load_ratio).
 *
 * Only strictly positive (ratio, penalty) pairs contribute (log domain).
 */
export function fitPowerLaw(
  points: Array<{ ratio: number; penalty: number }>,
): PowerLawFit | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { ratio, penalty } of points) {
    if (ratio > 0 && penalty > 0) {
      xs.push(Math.log(ratio));
      ys.push(Math.log(penalty));
    }
  }
  if (xs.length < 2) {
    return null;
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    sxy += dx * (ys[i]! - meanY);
    sxx += dx * dx;
  }
  if (sxx === 0) {
    return null;
  }
  const p = sxy / sxx;
  const logK = meanY - p * meanX;
  return { k: Math.exp(logK), p };
}

/** Coefficients for the per-link logistic targeting-risk model. */
export interface LogisticFit {
  b0: number;
  b1: number;
}

function sigmoid(z: number): number {
  if (z >= 0) {
    return 1 / (1 + Math.exp(-z));
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

/**
 * Fit a single-feature logistic regression `P(y=1) = sigmoid(b0 + b1 * x)`
 * using Newton–Raphson (IRLS). Deterministic and dependency-free.
 *
 * A tiny L2 ridge (lambda) is applied to keep the Hessian well-conditioned and
 * to guard against separation, mirroring scikit-learn's default regularization.
 */
export function fitLogistic(
  points: Array<{ x: number; y: number }>,
  { iterations = 100, lambda = 0 }: { iterations?: number; lambda?: number } = {},
): LogisticFit {
  let b0 = 0;
  let b1 = 0;
  const n = points.length;
  for (let iter = 0; iter < iterations; iter += 1) {
    // Gradient (g) and Hessian (H) of the penalized negative log-likelihood.
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (const { x, y } of points) {
      const pi = sigmoid(b0 + b1 * x);
      const w = pi * (1 - pi);
      g0 += pi - y;
      g1 += (pi - y) * x;
      h00 += w;
      h01 += w * x;
      h11 += w * x * x;
    }
    // Ridge only on the slope (b1), matching sklearn (intercept unpenalized).
    g1 += lambda * b1;
    h11 += lambda;
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) {
      break;
    }
    const step0 = (h11 * g0 - h01 * g1) / det;
    const step1 = (-h01 * g0 + h00 * g1) / det;
    b0 -= step0;
    b1 -= step1;
    if (Math.abs(step0) < 1e-10 && Math.abs(step1) < 1e-10) {
      break;
    }
  }
  void n;
  return { b0, b1 };
}

/** Per-link telemetry delta statistics used by the trust model. */
export interface DeltaStats {
  mean_delta_ms: number;
  std_delta_ms: number;
  mean_measured_ms: number;
  count: number;
}

/**
 * Compute mean/std of the under-reporting delta (measured - self_reported)
 * per link. A large systematically positive delta is Chimera spoofing.
 */
export function computeDeltaStats(
  deltasByLink: Map<string, { deltas: number[]; measured: number[] }>,
): Map<string, DeltaStats> {
  const out = new Map<string, DeltaStats>();
  for (const [linkId, { deltas, measured }] of deltasByLink) {
    const count = deltas.length;
    if (count === 0) continue;
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / count;
    const variance =
      deltas.reduce((a, b) => a + (b - meanDelta) * (b - meanDelta), 0) / count;
    const meanMeasured = measured.reduce((a, b) => a + b, 0) / count;
    out.set(linkId, {
      mean_delta_ms: meanDelta,
      std_delta_ms: Math.sqrt(variance),
      mean_measured_ms: meanMeasured,
      count,
    });
  }
  return out;
}

/**
 * A link is flagged compromised (spoofed) when it systematically under-reports:
 * the mean delta is both large in absolute terms and a meaningful fraction of
 * the true measured latency (separating spoofing from honest noise).
 */
export function isCompromised(stats: DeltaStats): boolean {
  const ABSOLUTE_MS = 15000;
  const RELATIVE_FRACTION = 0.15;
  return (
    stats.mean_delta_ms > ABSOLUTE_MS &&
    stats.mean_delta_ms > RELATIVE_FRACTION * stats.mean_measured_ms
  );
}

/** Round to a fixed number of decimals (stable JSON output). */
export function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
