import { describe, expect, it } from "vitest";

import { evaluateLink, neutralLinkState } from "./link-evaluation";

describe("evaluateLink", () => {
  it("blocks saturated links", () => {
    const state = neutralLinkState("Aegis", "Boreas");
    state.status = "saturated";
    state.self_reported_latency_ms = null;

    const result = evaluateLink(state, 500);
    expect(result.blocked).toBe(true);
    expect(result.evaluation.predicted_congestion_penalty_ms).toBe(0);
  });

  it("scores healthy links with positive combined cost", () => {
    const state = neutralLinkState("Caelum", "Fenix");
    state.load_ratio = 0.1;
    state.traffic_share = 0.05;
    state.self_reported_latency_ms = 9_999_999;

    const result = evaluateLink(state, 500);
    expect(result.blocked).toBe(false);
    expect(result.evaluation.combined_cost).toBeGreaterThan(500);
  });
});
