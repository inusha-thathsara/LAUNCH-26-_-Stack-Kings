import { describe, expect, it } from "vitest";

import { detectLinkAnomaly, evaluateLink, neutralLinkState } from "./link-evaluation";
import {
  ANOMALY_CONSERVATIVE_TARGETING,
  ANOMALY_CONSERVATIVE_TRUST,
} from "./constants";
import type { ChimeraLinkState } from "./types";

function healthyState(): ChimeraLinkState {
  const state = neutralLinkState("Caelum", "Fenix");
  state.load_ratio = 0.1;
  state.traffic_share = 0.05;
  state.self_reported_latency_ms = 9_999_999;
  return state;
}

describe("detectLinkAnomaly", () => {
  it("passes a healthy link through unchanged", () => {
    const result = detectLinkAnomaly(healthyState());
    expect(result.anomalous).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("does not flag a legitimately saturated link (null latency)", () => {
    const state = neutralLinkState("Aegis", "Boreas");
    state.status = "saturated";
    state.self_reported_latency_ms = null;
    const result = detectLinkAnomaly(state);
    expect(result.anomalous).toBe(false);
  });

  it("flags and clamps out-of-range load_ratio", () => {
    const state = healthyState();
    state.load_ratio = 1.8;
    const result = detectLinkAnomaly(state);
    expect(result.anomalous).toBe(true);
    expect(result.sanitized.load_ratio).toBe(1);
  });

  it("flags NaN traffic_share and clamps to mid-range", () => {
    const state = healthyState();
    state.traffic_share = Number.NaN;
    const result = detectLinkAnomaly(state);
    expect(result.anomalous).toBe(true);
    expect(result.sanitized.traffic_share).toBe(0.5);
  });

  it("flags negative self_reported_latency_ms", () => {
    const state = healthyState();
    state.self_reported_latency_ms = -42;
    const result = detectLinkAnomaly(state);
    expect(result.anomalous).toBe(true);
    expect(result.sanitized.self_reported_latency_ms).toBe(0);
  });

  it("flags an unknown status", () => {
    const state = healthyState();
    (state as { status: string }).status = "meltdown";
    const result = detectLinkAnomaly(state);
    expect(result.anomalous).toBe(true);
    expect(result.sanitized.status).toBe("ok");
  });
});

describe("evaluateLink anomaly handling", () => {
  it("never emits NaN scores for garbage telemetry", () => {
    const state = healthyState();
    state.load_ratio = Number.NaN;
    state.traffic_share = Number.POSITIVE_INFINITY;
    state.self_reported_latency_ms = Number.NaN;

    const result = evaluateLink(state, 500);
    const { evaluation } = result;
    expect(Number.isFinite(evaluation.predicted_congestion_penalty_ms)).toBe(true);
    expect(Number.isFinite(evaluation.trust_score)).toBe(true);
    expect(Number.isFinite(evaluation.targeting_risk_score)).toBe(true);
    expect(Number.isFinite(evaluation.combined_cost)).toBe(true);
  });

  it("applies conservative scores to anomalous links", () => {
    const state = healthyState();
    state.traffic_share = 5; // out of [0,1]
    const result = evaluateLink(state, 500);
    expect(result.anomaly).toBe(true);
    expect(result.anomalyReason).toBeTruthy();
    expect(result.evaluation.trust_score).toBeLessThanOrEqual(
      ANOMALY_CONSERVATIVE_TRUST,
    );
    expect(result.evaluation.targeting_risk_score).toBeGreaterThanOrEqual(
      ANOMALY_CONSERVATIVE_TARGETING,
    );
  });

  it("keeps anomalous links usable (not hard-blocked on trust alone)", () => {
    const state = healthyState();
    state.load_ratio = 1.5; // clamps to 1 (below saturation 0.9? no, 1 >= 0.9)
    // Use traffic_share anomaly instead so it is not saturated.
    state.load_ratio = 0.2;
    state.traffic_share = -3;
    const result = evaluateLink(state, 500);
    expect(result.anomaly).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("still hard-blocks genuinely saturated links", () => {
    const state = neutralLinkState("Aegis", "Boreas");
    state.status = "saturated";
    state.self_reported_latency_ms = null;
    const result = evaluateLink(state, 500);
    expect(result.blocked).toBe(true);
  });

  it("keeps a healthy link unblocked and non-anomalous", () => {
    const result = evaluateLink(healthyState(), 500);
    expect(result.anomaly).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.evaluation.combined_cost).toBeGreaterThan(500);
  });
});
