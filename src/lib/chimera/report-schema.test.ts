import { describe, expect, it } from "vitest";

import { assertValidRoutingReport, ReportValidationError } from "./report-schema";
import type { Phase2RoutingReport } from "./types";

function validReport(): Phase2RoutingReport {
  return {
    origin_id: "Aegis",
    destination_id: "Boreas",
    chosen_path: ["Aegis", "Boreas"],
    link_evaluations: [
      {
        link_id: "Aegis-Boreas",
        predicted_congestion_penalty_ms: 12.5,
        trust_score: 0.9,
        targeting_risk_score: 0.1,
        combined_cost: 1234.567,
      },
    ],
    final_latency_estimate_ms: 1500.25,
    explanation: "Routed via the physics baseline; no overrides needed.",
  };
}

describe("assertValidRoutingReport", () => {
  it("accepts a well-formed report and returns it", () => {
    const report = validReport();
    expect(assertValidRoutingReport(report)).toEqual(report);
  });

  it("accepts a report with an empty link_evaluations list", () => {
    const report = { ...validReport(), link_evaluations: [] };
    expect(() => assertValidRoutingReport(report)).not.toThrow();
  });

  it("accepts a negative combined_cost (entropy bonus can dominate)", () => {
    const report = validReport();
    report.link_evaluations[0]!.combined_cost = -50;
    expect(() => assertValidRoutingReport(report)).not.toThrow();
  });

  it("throws ReportValidationError when a required field is missing", () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete report.explanation;
    expect(() => assertValidRoutingReport(report)).toThrow(ReportValidationError);
  });

  it("rejects an empty chosen_path", () => {
    const report = { ...validReport(), chosen_path: [] };
    expect(() => assertValidRoutingReport(report)).toThrow(ReportValidationError);
  });

  it("rejects a trust_score outside [0, 1]", () => {
    const report = validReport();
    report.link_evaluations[0]!.trust_score = 1.5;
    expect(() => assertValidRoutingReport(report)).toThrow(ReportValidationError);
  });

  it("rejects a negative final_latency_estimate_ms", () => {
    const report = { ...validReport(), final_latency_estimate_ms: -1 };
    expect(() => assertValidRoutingReport(report)).toThrow(ReportValidationError);
  });

  it("rejects unknown extra fields (strict schema)", () => {
    const report = { ...validReport(), rogue_field: true };
    expect(() => assertValidRoutingReport(report)).toThrow(ReportValidationError);
  });

  it("surfaces issue paths on failure", () => {
    const report = validReport();
    report.link_evaluations[0]!.targeting_risk_score = 5;
    try {
      assertValidRoutingReport(report);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ReportValidationError);
      expect((error as ReportValidationError).issues.join(" ")).toContain(
        "targeting_risk_score",
      );
    }
  });
});
