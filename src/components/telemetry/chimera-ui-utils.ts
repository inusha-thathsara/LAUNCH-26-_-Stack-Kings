import type { LinkEvaluation } from "@/lib/relic/types";

export interface PreviewIntent {
  origin: string | null;
  destination: string | null;
  payload: string | null;
}

/**
 * Best-effort, client-side preview of the structured intent so the operator can
 * see the parsed origin / destination / payload BEFORE routing. This mirrors the
 * server rules-layer heuristics (from/to, arrow, quoted/`send …` payload) but is
 * display-only — the server-side hybrid parser remains the source of truth.
 */
export function previewParseIntent(text: string, nodeIds: string[]): PreviewIntent {
  const result: PreviewIntent = { origin: null, destination: null, payload: null };
  const trimmed = text.trim();
  if (!trimmed) return result;

  const resolve = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const token = raw.trim().toLowerCase();
    return nodeIds.find((id) => id.toLowerCase() === token) ?? null;
  };

  const fromTo = trimmed.match(/\bfrom\s+([A-Za-z][\w-]*)\s+to\s+([A-Za-z][\w-]*)/i);
  const arrow = trimmed.match(/\b([A-Za-z][\w-]*)\s*(?:->|→)\s*([A-Za-z][\w-]*)/);
  if (fromTo) {
    result.origin = resolve(fromTo[1]);
    result.destination = resolve(fromTo[2]);
  } else if (arrow) {
    result.origin = resolve(arrow[1]);
    result.destination = resolve(arrow[2]);
  }

  const quoted = trimmed.match(/["']([^"']+)["']/);
  const payloadField = trimmed.match(/\bpayload\s*:\s*["']?([^"'\n]+)["']?/i);
  const sendMatch = trimmed.match(/^\s*send\s+(.+?)\s+from\s+/i);
  const payload =
    quoted?.[1] ?? payloadField?.[1]?.trim() ?? sendMatch?.[1]?.trim() ?? null;
  result.payload = payload && payload.length > 0 ? payload : null;

  return result;
}

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
