/**
 * Congestion prediction model.
 *
 * Owner: Ruwan (Phase 1 — section 1.2)
 *
 * Training data: link_traffic_history.csv
 * Features: load_ratio, load_units, status, lagged load
 * Target: observed_latency_ms penalty above physics baseline, OR binary saturated flag
 *
 * Approach:
 *  v1: Piecewise / linear regression — fit penalty_ms = k * load_ratio^p per link + global fallback
 *  Coefficients serialised to congestion.model.json for runtime use (no Python dep)
 *
 * Runtime contract:
 *   predictCongestion(linkState, physicsVoidMs) → { penalty_ms, is_saturated }
 *   If status === "saturated" OR self_reported_latency_ms === null → hard unavailable
 */

import type { ChimeraLinkState } from "../types";
import coefficientsData from "./congestion.model.json";

const CONGESTION_COEFFS: Record<string, { k: number; p: number }> = coefficientsData;

// Global fallback if link is not in the json
const GLOBAL_FALLBACK = { k: 600000, p: 2.25 };

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
 * @param _physicsVoidMs - Phase 1 baseline void travel time for this hop
 * @returns Congestion penalty and availability flag
 */
export function predictCongestion(
  linkState: ChimeraLinkState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _physicsVoidMs: number,
): CongestionResult {
  // Explicit saturation guard — must never be skipped
  if (linkState.status === "saturated" || linkState.self_reported_latency_ms === null) {
    return { penalty_ms: 0, is_saturated: true };
  }

  // Also enforce saturation fallback threshold if load_ratio is >= 0.90
  if (linkState.load_ratio >= 0.9) {
    return { penalty_ms: 0, is_saturated: true };
  }

  const coeffs = CONGESTION_COEFFS[linkState.link_id] || GLOBAL_FALLBACK;
  const penalty_ms = coeffs.k * Math.pow(linkState.load_ratio, coeffs.p);

  return {
    penalty_ms,
    is_saturated: false,
  };
}
