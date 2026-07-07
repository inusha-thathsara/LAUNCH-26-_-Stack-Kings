import { describe, expect, it } from "vitest";
import { predictCongestion } from "./congestion";
import { scoreTrust } from "./trust";
import { scoreTargetingRisk } from "./targeting";
import congestionModel from "./congestion.model.json";
import targetingModel from "./targeting.model.json";
import type { ChimeraLinkState } from "../types";

const congestionCoeffs = congestionModel as Record<string, { k: number; p: number }>;
const targetingCoeffs = targetingModel as Record<string, { b0: number; b1: number }>;

function baseState(overrides: Partial<ChimeraLinkState> = {}): ChimeraLinkState {
  return {
    link_id: "Aegis-Boreas",
    planet_a: "Aegis",
    planet_b: "Boreas",
    capacity_units: 208,
    current_load: 90,
    load_ratio: 0.4328,
    self_reported_latency_ms: 118000,
    traffic_share: 0.03833,
    status: "ok",
    ...overrides,
  };
}

describe("Analytical Models", () => {
  describe("predictCongestion", () => {
    it("returns is_saturated when status is saturated", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 200,
        load_ratio: 0.9615,
        self_reported_latency_ms: null,
        traffic_share: 0.05,
        status: "saturated",
      };
      const result = predictCongestion(mockState, 60093.219);
      expect(result.is_saturated).toBe(true);
      expect(result.penalty_ms).toBe(0);
    });

    it("returns is_saturated when self_reported_latency_ms is null", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 200,
        load_ratio: 0.9615,
        self_reported_latency_ms: null,
        traffic_share: 0.05,
        status: "ok",
      };
      const result = predictCongestion(mockState, 60093.219);
      expect(result.is_saturated).toBe(true);
      expect(result.penalty_ms).toBe(0);
    });

    it("returns is_saturated when load_ratio >= 0.90", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 190,
        load_ratio: 0.9135,
        self_reported_latency_ms: 120000,
        traffic_share: 0.05,
        status: "ok",
      };
      const result = predictCongestion(mockState, 60093.219);
      expect(result.is_saturated).toBe(true);
    });

    it("predicts congestion penalty matching the trained power-law coefficients", () => {
      const mockState = baseState({
        load_ratio: 0.4328,
        self_reported_latency_ms: 118635.583,
      });
      const result = predictCongestion(mockState, 60093.219);
      expect(result.is_saturated).toBe(false);

      const { k, p } = congestionCoeffs["Aegis-Boreas"]!;
      const expected = k * Math.pow(0.4328, p);
      expect(result.penalty_ms).toBeCloseTo(expected, 3);
    });

    it("increases the congestion penalty monotonically with load ratio", () => {
      const low = predictCongestion(baseState({ load_ratio: 0.2 }), 60093.219);
      const mid = predictCongestion(baseState({ load_ratio: 0.5 }), 60093.219);
      const high = predictCongestion(baseState({ load_ratio: 0.8 }), 60093.219);
      expect(mid.penalty_ms).toBeGreaterThan(low.penalty_ms);
      expect(high.penalty_ms).toBeGreaterThan(mid.penalty_ms);
    });

    it("falls back to a global power law for unknown links", () => {
      const result = predictCongestion(
        baseState({
          link_id: "Unknown-Link",
          planet_a: "Unknown",
          planet_b: "Link",
          load_ratio: 0.5,
        }),
        50000,
      );
      expect(result.is_saturated).toBe(false);
      expect(result.penalty_ms).toBeGreaterThan(0);
    });
  });

  describe("scoreTrust", () => {
    it("returns 0.0 for saturated or null self-reported latency links", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Elysium",
        planet_a: "Aegis",
        planet_b: "Elysium",
        capacity_units: 202,
        current_load: 202,
        load_ratio: 1.0,
        self_reported_latency_ms: null,
        traffic_share: 0.05,
        status: "saturated",
      };
      expect(scoreTrust(mockState)).toBe(0.0);
    });

    it("returns 1.0 for honest links with normal noise", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 90,
        load_ratio: 0.4328,
        self_reported_latency_ms: 118000, // close to expected 118591
        traffic_share: 0.03833,
        status: "ok",
      };
      expect(scoreTrust(mockState)).toBe(1.0);
    });

    it("returns a low trust score for historically compromised link showing spoofing pattern", () => {
      // Aegis-Elysium Tv = 153398.63. With load_ratio = 0.1508, expected latency is around 162739 ms
      // If it reports 84307 ms (which is ~78431 ms lower than expected), it matches the spoofing delta
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Elysium",
        planet_a: "Aegis",
        planet_b: "Elysium",
        capacity_units: 202,
        current_load: 30.5,
        load_ratio: 0.1508,
        self_reported_latency_ms: 84307,
        traffic_share: 0.05,
        status: "ok",
      };
      const score = scoreTrust(mockState);
      expect(score).toBeLessThan(0.3);
      expect(score).toBeGreaterThanOrEqual(0.0);
    });

    it("flags unseen compromised link showing large latency under-reporting anomaly", () => {
      // Caelum-Dawn Tv = 115464.29. With load_ratio = 0.0, expected is ~115464 ms.
      // If it reports 60000 ms (under-reports by > 55,000 ms), it's highly anomalous
      const mockState: ChimeraLinkState = {
        link_id: "Caelum-Dawn",
        planet_a: "Caelum",
        planet_b: "Dawn",
        capacity_units: 92,
        current_load: 0,
        load_ratio: 0.0,
        self_reported_latency_ms: 60000,
        traffic_share: 0.02,
        status: "ok",
      };
      expect(scoreTrust(mockState)).toBeLessThan(0.5);
    });
  });

  describe("scoreTargetingRisk", () => {
    it("matches the trained logistic coefficients", () => {
      const share = 0.35;
      const score = scoreTargetingRisk(baseState({ traffic_share: share }));
      const { b0, b1 } = targetingCoeffs["Aegis-Boreas"]!;
      const expected = 1 / (1 + Math.exp(-(b0 + b1 * share)));
      expect(score).toBeCloseTo(expected, 4);
    });

    it("rises monotonically with traffic share and stays in [0, 1]", () => {
      const low = scoreTargetingRisk(baseState({ traffic_share: 0.02 }));
      const high = scoreTargetingRisk(baseState({ traffic_share: 0.4 }));
      expect(high).toBeGreaterThan(low);
      expect(low).toBeGreaterThanOrEqual(0);
      expect(high).toBeLessThanOrEqual(1);
    });

    it("falls back to the global logistic model for unknown links", () => {
      const score = scoreTargetingRisk(
        baseState({
          link_id: "Unknown-Link",
          planet_a: "Unknown",
          planet_b: "Link",
          traffic_share: 0.3,
        }),
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });
});
