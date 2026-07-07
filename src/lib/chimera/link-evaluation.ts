/**
 * Shared link scoring for the Chimera Co-Pilot (congestion + trust + targeting).
 *
 * Phase 5 hardening: every live link state is first passed through
 * `detectLinkAnomaly`, which sanitises out-of-distribution telemetry so the
 * analytical models can never emit NaN/Infinity (which would break the mandatory
 * report schema) and never crash. Anomalous links receive conservative scores
 * (low trust, high targeting risk) so routing steers away from unseen vectors.
 */

import type { ChimeraLinkState, LinkEvaluation } from "./types";
import { canonicalLinkId } from "./link-id";
import {
  ANOMALY_CONSERVATIVE_TARGETING,
  ANOMALY_CONSERVATIVE_TRUST,
  ENTROPY_BONUS_SCALE_MS,
  TARGETING_SCALE_MS,
  TRUST_FLOOR,
  TRUST_SCALE_MS,
} from "./constants";
import { predictCongestion } from "./models/congestion";
import { scoreTrust } from "./models/trust";
import { scoreTargetingRisk } from "./models/targeting";

export interface LinkScoreResult {
  evaluation: LinkEvaluation;
  /** When true the link must not be used for this routing tick. */
  blocked: boolean;
  blockReason?: string;
  /** True when the live telemetry was out-of-distribution and was sanitised. */
  anomaly: boolean;
  /** Human-readable summary of the anomaly (undefined when not anomalous). */
  anomalyReason?: string;
}

export interface AnomalyResult {
  anomalous: boolean;
  reasons: string[];
  /** Clamped copy of the link state, safe to feed to the analytical models. */
  sanitized: ChimeraLinkState;
}

function isBadNumber(value: unknown): boolean {
  return typeof value !== "number" || !Number.isFinite(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

/**
 * Detect out-of-distribution telemetry and return a sanitised link state.
 *
 * Sanitisation clamps every numeric field into its valid domain so downstream
 * models are always fed finite, in-range inputs. A `null`
 * `self_reported_latency_ms` is legitimate (it signals saturation) and is not
 * treated as an anomaly.
 */
export function detectLinkAnomaly(linkState: ChimeraLinkState): AnomalyResult {
  const reasons: string[] = [];
  const s: ChimeraLinkState = { ...linkState };

  if (isBadNumber(s.capacity_units) || s.capacity_units <= 0) {
    reasons.push(`capacity_units out of range (${String(linkState.capacity_units)})`);
    s.capacity_units = 100;
  }

  if (isBadNumber(s.current_load) || s.current_load < 0) {
    reasons.push(`current_load out of range (${String(linkState.current_load)})`);
    s.current_load = 0;
  }

  if (isBadNumber(s.load_ratio) || s.load_ratio < 0 || s.load_ratio > 1) {
    reasons.push(`load_ratio out of [0,1] (${String(linkState.load_ratio)})`);
    // NaN → mid-range uncertainty; finite out-of-range → clamp to nearest bound.
    s.load_ratio = isBadNumber(s.load_ratio)
      ? 0.5
      : Math.min(1, Math.max(0, s.load_ratio));
  }

  if (isBadNumber(s.traffic_share) || s.traffic_share < 0 || s.traffic_share > 1) {
    reasons.push(`traffic_share out of [0,1] (${String(linkState.traffic_share)})`);
    s.traffic_share = isBadNumber(s.traffic_share)
      ? 0.5
      : Math.min(1, Math.max(0, s.traffic_share));
  }

  if (
    s.self_reported_latency_ms !== null &&
    (isBadNumber(s.self_reported_latency_ms) || s.self_reported_latency_ms < 0)
  ) {
    reasons.push(
      `self_reported_latency_ms invalid (${String(linkState.self_reported_latency_ms)})`,
    );
    s.self_reported_latency_ms = 0;
  }

  if (s.status !== "ok" && s.status !== "saturated") {
    reasons.push(`unknown status (${String(linkState.status)})`);
    s.status = "ok";
  }

  return { anomalous: reasons.length > 0, reasons, sanitized: s };
}

/**
 * Score a single interplanetary link using the three analytical sub-models.
 */
export function evaluateLink(
  linkState: ChimeraLinkState,
  physicsVoidMs: number,
): LinkScoreResult {
  const { anomalous, reasons, sanitized } = detectLinkAnomaly(linkState);
  const state = sanitized;
  const anomalyReason = anomalous ? reasons.join("; ") : undefined;

  const congestion = predictCongestion(state, physicsVoidMs);
  let trustScore = scoreTrust(state);
  let targetingRisk = scoreTargetingRisk(state);
  let penaltyMs = Number.isFinite(congestion.penalty_ms) ? congestion.penalty_ms : 0;

  // Defensive guards: never let a non-finite model output reach the report.
  if (!Number.isFinite(trustScore)) trustScore = ANOMALY_CONSERVATIVE_TRUST;
  if (!Number.isFinite(targetingRisk)) targetingRisk = ANOMALY_CONSERVATIVE_TARGETING;

  // Conservative override for out-of-distribution telemetry.
  if (anomalous) {
    trustScore = Math.min(trustScore, ANOMALY_CONSERVATIVE_TRUST);
    targetingRisk = Math.max(targetingRisk, ANOMALY_CONSERVATIVE_TARGETING);
  }

  trustScore = clamp01(trustScore);
  targetingRisk = clamp01(targetingRisk);
  if (penaltyMs < 0) penaltyMs = 0;

  const trustPenalty = (1 - trustScore) * TRUST_SCALE_MS;
  const targetingPenalty = targetingRisk * TARGETING_SCALE_MS;
  const entropyBonus = -state.traffic_share * ENTROPY_BONUS_SCALE_MS;

  const combinedCost =
    physicsVoidMs + penaltyMs + trustPenalty + targetingPenalty + entropyBonus;

  const evaluation: LinkEvaluation = {
    link_id: state.link_id,
    predicted_congestion_penalty_ms: round3(penaltyMs),
    trust_score: round4(trustScore),
    targeting_risk_score: round4(targetingRisk),
    combined_cost: round3(combinedCost),
  };

  if (congestion.is_saturated) {
    return {
      evaluation,
      blocked: true,
      blockReason: `Link ${state.link_id} is saturated.`,
      anomaly: anomalous,
      anomalyReason,
    };
  }

  // Genuine low-trust (e.g. a known spoofed link) hard-blocks. Anomalies are NOT
  // hard-blocked on trust alone — they stay usable as a last resort while their
  // inflated combined_cost steers the router away when alternatives exist.
  if (trustScore < TRUST_FLOOR && !anomalous) {
    return {
      evaluation,
      blocked: true,
      blockReason: `Link ${state.link_id} trust score ${trustScore.toFixed(2)} below floor ${TRUST_FLOOR}.`,
      anomaly: anomalous,
      anomalyReason,
    };
  }

  return { evaluation, blocked: false, anomaly: anomalous, anomalyReason };
}

/** Build a neutral ChimeraLinkState for hops with no live telemetry entry. */
export function neutralLinkState(
  planetA: string,
  planetB: string,
  capacityUnits = 100,
): ChimeraLinkState {
  const link_id = canonicalLinkId(planetA, planetB);
  return {
    link_id,
    planet_a: planetA < planetB ? planetA : planetB,
    planet_b: planetA < planetB ? planetB : planetA,
    capacity_units: capacityUnits,
    current_load: 0,
    load_ratio: 0,
    self_reported_latency_ms: 0,
    traffic_share: 0,
    status: "ok",
  };
}
