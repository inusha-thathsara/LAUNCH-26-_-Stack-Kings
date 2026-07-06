/**
 * Congestion prediction model stub.
 *
 * Owner: Ruwan (Phase 1 — section 1.2)
 *
 * Training data: link_traffic_history.csv
 * Features: load_ratio, load_units, status, lagged load
 * Target: observed_latency_ms penalty above physics baseline, OR binary saturated flag
 *
 * Approach:
 *  v1: Piecewise / linear regression — fit penalty_ms = f(load_ratio) per link + global fallback
 *  v2: Logistic threshold for slow → saturated transition
 *  Coefficients serialised to congestion.model.json for runtime use (no Python dep)
 *
 * Runtime contract:
 *   predictCongestion(linkState, physicsVoidMs) → { penalty_ms, is_saturated }
 *   If status === "saturated" OR self_reported_latency_ms === null → hard unavailable
 */

import type { ChimeraLinkState } from "../types";

export interface CongestionResult {
  /** Additional ms Chimera adds above the physics void latency. */
  penalty_ms: number;
  /** True when the link must be treated as unavailable (blocked edge). */
  is_saturated: boolean;
}

/**
 * Predict Chimera-induced congestion penalty for a link.
 *
 * @param linkState  - Live state from Chimera /state endpoint
 * @param physicsVoidMs - Phase 1 baseline void travel time for this hop
 * @returns Congestion penalty and availability flag
 */
// TODO (Ruwan — Phase 1): implement model; load coefficients from congestion.model.json
export function predictCongestion(
  linkState: ChimeraLinkState,
  _physicsVoidMs: number,
): CongestionResult {
  // Explicit saturation guard — must never be skipped
  if (linkState.status === "saturated" || linkState.self_reported_latency_ms === null) {
    return { penalty_ms: 0, is_saturated: true };
  }
  throw new Error("predictCongestion() not yet implemented — Phase 1 task.");
}
