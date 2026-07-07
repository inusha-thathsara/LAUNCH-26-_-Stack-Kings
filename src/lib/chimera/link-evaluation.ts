/**
 * Shared link scoring for the Chimera Co-Pilot (congestion + trust + targeting).
 */

import type { ChimeraLinkState, LinkEvaluation } from "./types";
import { canonicalLinkId } from "./link-id";
import {
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
}

/**
 * Score a single interplanetary link using the three analytical sub-models.
 */
export function evaluateLink(
  linkState: ChimeraLinkState,
  physicsVoidMs: number,
): LinkScoreResult {
  const congestion = predictCongestion(linkState, physicsVoidMs);
  const trustScore = scoreTrust(linkState);
  const targetingRisk = scoreTargetingRisk(linkState);

  const trustPenalty = (1 - trustScore) * TRUST_SCALE_MS;
  const targetingPenalty = targetingRisk * TARGETING_SCALE_MS;
  const entropyBonus = -linkState.traffic_share * ENTROPY_BONUS_SCALE_MS;

  const combinedCost =
    physicsVoidMs +
    congestion.penalty_ms +
    trustPenalty +
    targetingPenalty +
    entropyBonus;

  const evaluation: LinkEvaluation = {
    link_id: linkState.link_id,
    predicted_congestion_penalty_ms: congestion.penalty_ms,
    trust_score: trustScore,
    targeting_risk_score: targetingRisk,
    combined_cost: Math.round(combinedCost * 1000) / 1000,
  };

  if (congestion.is_saturated) {
    return {
      evaluation,
      blocked: true,
      blockReason: `Link ${linkState.link_id} is saturated.`,
    };
  }
  if (trustScore < TRUST_FLOOR) {
    return {
      evaluation,
      blocked: true,
      blockReason: `Link ${linkState.link_id} trust score ${trustScore.toFixed(2)} below floor ${TRUST_FLOOR}.`,
    };
  }

  return { evaluation, blocked: false };
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
