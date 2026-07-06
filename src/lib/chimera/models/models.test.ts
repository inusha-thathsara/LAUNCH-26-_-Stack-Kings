import { describe, expect, it } from "vitest";
import { predictCongestion } from "./congestion";
import { scoreTrust } from "./trust";
import { scoreTargetingRisk } from "./targeting";
import type { ChimeraLinkState } from "../types";

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

    it("predicts congestion penalty for non-saturated links", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 90,
        load_ratio: 0.4328,
        self_reported_latency_ms: 118635.583,
        traffic_share: 0.03833,
        status: "ok",
      };
      const result = predictCongestion(mockState, 60093.219);
      expect(result.is_saturated).toBe(false);
      // expected: k=383782.122, p=2.261 -> 383782.122 * Math.pow(0.4328, 2.261) = 57773.70 ms
      expect(result.penalty_ms).toBeCloseTo(57773.7, 0);
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
    it("calculates targeting risk score using logistic regression", () => {
      const mockState: ChimeraLinkState = {
        link_id: "Aegis-Boreas",
        planet_a: "Aegis",
        planet_b: "Boreas",
        capacity_units: 208,
        current_load: 90,
        load_ratio: 0.4328,
        self_reported_latency_ms: 118000,
        traffic_share: 0.35, // High traffic share
        status: "ok",
      };
      const score = scoreTargetingRisk(mockState);
      // expected: z = -2.21305 + 1.99644 * 0.35 = -1.5143
      // probability = 1 / (1 + exp(1.5143)) = 0.1803
      expect(score).toBeCloseTo(0.1803, 3);
    });
  });
});
