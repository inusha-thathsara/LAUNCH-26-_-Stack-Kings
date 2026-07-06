/**
 * Targeting-risk model stub.
 *
 * Owner: Ruwan (Phase 1 — section 1.4)
 *
 * Training data: link_incident_history.csv
 * Features: traffic_share, rolling share, path popularity proxies, link prior
 * Target: jammed_flag (boolean) → P(jammed | features)
 *
 * Approach:
 *  - Classifier: P(jammed | traffic_share, recent_share, link_id prior)
 *  - Supports route entropy directive: penalise paths that reuse high-share links
 *  - Runtime: uses live traffic_share from /state
 */

import type { ChimeraLinkState } from "../types";

/**
 * Score the probability that Chimera will target this link.
 *
 * @param linkState - Live state from Chimera /state endpoint
 * @returns targeting_risk_score in [0, 1]; 1.0 = very likely jammed
 */
// TODO (Ruwan — Phase 1): implement classifier using incident history
export function scoreTargetingRisk(_linkState: ChimeraLinkState): number {
  throw new Error("scoreTargetingRisk() not yet implemented — Phase 1 task.");
}
