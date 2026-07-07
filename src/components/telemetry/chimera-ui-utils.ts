import type { LinkEvaluation } from "@/lib/relic/types";

/** Parse baseline planet path from Co-Pilot explanation text. */
export function parseBaselinePathFromExplanation(explanation: string): string[] | null {
  const match = explanation.match(/Baseline physics path was ([^.]+)\./);
  if (!match?.[1]) return null;
  return match[1]
    .split(/\s*→\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Map link_id → evaluation for O(1) map lookups. */
export function evaluationsByLinkId(
  evaluations: LinkEvaluation[],
): Map<string, LinkEvaluation> {
  return new Map(evaluations.map((evaluation) => [evaluation.link_id, evaluation]));
}

/** Interpolate trust score to a green→red stroke colour. */
export function trustScoreColor(trustScore: number): string {
  const clamped = Math.max(0, Math.min(1, trustScore));
  const red = Math.round(255 * (1 - clamped));
  const green = Math.round(200 * clamped + 55 * (1 - clamped));
  return `rgba(${red}, ${green}, 72, 0.9)`;
}

export const TRUST_RISK_THRESHOLD = 0.5;
export const TARGETING_HIGH_THRESHOLD = 0.55;
export const CONGESTION_SATURATED_MS = 50_000;

export function isLinkBlocked(evaluation: LinkEvaluation): boolean {
  return (
    evaluation.trust_score < TRUST_RISK_THRESHOLD ||
    evaluation.predicted_congestion_penalty_ms >= CONGESTION_SATURATED_MS
  );
}

export function isHighTargetingRisk(evaluation: LinkEvaluation): boolean {
  return evaluation.targeting_risk_score >= TARGETING_HIGH_THRESHOLD;
}
