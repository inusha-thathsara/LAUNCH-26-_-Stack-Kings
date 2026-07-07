/**
 * Targeting-risk model.
 *
 * Owner: Ruwan (Phase 1 — section 1.4)
 *
 * Training data: link_incident_history.csv
 * Features: traffic_share, rolling share, path popularity proxies, link prior
 * Target: jammed_flag (boolean) → P(jammed | features)
 *
 * Approach:
 *  - Classifier: P(jammed | traffic_share, link_id) using logistic regression
 *  - Runtime: uses live traffic_share from /state
 */

import type { ChimeraLinkState } from "../types";
import targetingModelData from "./targeting.model.json";

interface LogisticParams {
  b0: number;
  b1: number;
}

const TARGETING_MODEL: Record<string, LogisticParams> = targetingModelData;

// Global fallback (pooled logistic fit across all links) for unseen link IDs.
// Produced by scripts/train-models.ts semantics; see INTELLIGENCE_REPORT.md.
const GLOBAL_FALLBACK: LogisticParams = { b0: -2.73647, b1: 3.61594 };

/**
 * Score the probability that Chimera will target this link.
 *
 * @param linkState - Live state from Chimera /state endpoint
 * @returns targeting_risk_score in [0, 1]; 1.0 = very likely jammed
 */
export function scoreTargetingRisk(linkState: ChimeraLinkState): number {
  const params = TARGETING_MODEL[linkState.link_id] || GLOBAL_FALLBACK;

  // Logit value: z = b0 + b1 * traffic_share
  const z = params.b0 + params.b1 * linkState.traffic_share;

  // Sigmoid probability: P = 1 / (1 + exp(-z))
  const probability = 1.0 / (1.0 + Math.exp(-z));

  return parseFloat(probability.toFixed(4));
}
