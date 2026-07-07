/** Trust scores below this floor cause the link to be treated as blocked. */
export const TRUST_FLOOR = 0.5;

/** Scale applied to `(1 - trust_score)` when computing True Cost (ms-equivalent). */
export const TRUST_SCALE_MS = 80_000;

/** Scale applied to `targeting_risk_score` when computing True Cost (ms-equivalent). */
export const TARGETING_SCALE_MS = 50_000;

/**
 * Entropy bonus: links with lower `traffic_share` receive a cost reduction up to
 * this many ms (rewarding route diversification).
 */
export const ENTROPY_BONUS_SCALE_MS = 25_000;

/** Minimum interval between live `/state` polls (ms). */
export const CHIMERA_POLL_INTERVAL_MS = 1_500;

/** Rules-parser confidence threshold; below this we defer to the LLM fallback. */
export const PARSER_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Route diversification tolerance. Alternative paths whose True Cost is within
 * this fraction of the optimal are considered "near-optimal" and the one with
 * the lowest aggregate targeting risk is preferred (entropy maximisation).
 */
export const ROUTE_DIVERSIFICATION_EPSILON = 0.05;
