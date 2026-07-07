/**
 * Strict runtime schema for the Council's mandatory Phase2RoutingReport.
 *
 * The competition disqualifies responses with missing or malformed fields, so
 * every `/api/route` response is validated against this Zod schema before it is
 * returned. This is a defensive guard on our own output — it complements the
 * TypeScript `Phase2RoutingReport` type with a runtime check.
 */

import { z } from "zod";

import type { Phase2RoutingReport } from "./types";

export const linkEvaluationSchema = z
  .object({
    link_id: z.string().min(1),
    predicted_congestion_penalty_ms: z.number().finite(),
    trust_score: z.number().min(0).max(1),
    targeting_risk_score: z.number().min(0).max(1),
    combined_cost: z.number().finite(),
  })
  .strict();

export const phase2RoutingReportSchema = z
  .object({
    origin_id: z.string().min(1),
    destination_id: z.string().min(1),
    chosen_path: z.array(z.string().min(1)).min(1),
    link_evaluations: z.array(linkEvaluationSchema),
    final_latency_estimate_ms: z.number().finite().nonnegative(),
    explanation: z.string().min(1),
  })
  .strict();

export class ReportValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = "ReportValidationError";
  }
}

/**
 * Validate a routing report against the Council schema.
 *
 * @throws {ReportValidationError} when the report does not match the schema.
 */
export function assertValidRoutingReport(report: unknown): Phase2RoutingReport {
  const result = phase2RoutingReportSchema.safeParse(report);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ReportValidationError(
      `Routing report failed Council schema validation: ${issues.join("; ")}`,
      issues,
    );
  }
  return result.data;
}
