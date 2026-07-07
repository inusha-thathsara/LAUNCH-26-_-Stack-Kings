/**
 * Chimera Co-Pilot agent orchestrator.
 *
 * Sequential flow (per challenge §4):
 *  1. Parse NL request → { origin_id, destination_id, payload }
 *  2. Generate baseline physics path (Phase 1 findShortestRoute)
 *  3. For each hop in path (SEQUENTIAL — not all at once):
 *       a. Fetch current link state from ChimeraClient tick cache
 *       b. Tool call: congestionTool(link) → penalty + is_saturated
 *       c. Tool call: trustTool(link)      → trust_score
 *       d. Tool call: targetingTool(link)  → targeting_risk_score
 *       e. Compute combined_cost
 *       f. If link unsafe → re-route from current node with updated blocked set
 *  4. Build link_evaluations[] for every link on final chosen path
 *  5. Compute final_latency_estimate_ms = physics + sum(congestion penalties)
 *  6. Generate explanation string (template + key factors)
 */

import { edgeKey } from "../../relic/graph";
import { findShortestRoute } from "../../relic/router";
import { getEngine } from "../../relic/server/universe";
import type { LinkEvaluation, Phase2RoutingReport } from "../types";
import { canonicalLinkId } from "../link-id";
import { chimeraClient } from "../client";
import { evaluateLink, neutralLinkState } from "../link-evaluation";
import { parseRoutingRequest } from "../parser/hybrid";
import {
  buildRoutingReport,
  computePhysicsLatencyForPath,
  formatPathExplanation,
} from "../routing-report";

const MAX_REROUTES = 64;

/**
 * Route a natural-language request through the full Co-Pilot evaluation pipeline.
 */
export async function routeWithCopilot(
  nlRequest: string,
): Promise<Phase2RoutingReport> {
  const { universe, geometry } = getEngine();
  const nodeIds = universe.nodes.map((node) => node.id);
  const intent = await parseRoutingRequest(nlRequest, nodeIds);

  await chimeraClient.getState();

  const capacityByLinkId = new Map(
    universe.interplanetaryLinks.map((link) => [link.link_id, link.capacity_units]),
  );

  // Step 2: baseline physics path (Phase 1), used purely for the audit narrative.
  const baseline = findShortestRoute(
    universe,
    geometry,
    intent.origin_id,
    intent.destination_id,
  );
  const baselinePath = baseline.deliverable ? baseline.path : [];

  const blockedEdges = new Set<string>();
  const path: string[] = [intent.origin_id];
  const evaluations: LinkEvaluation[] = [];
  const anomalies: string[] = [];
  let reroutes = 0;
  let current = intent.origin_id;

  while (current !== intent.destination_id) {
    if (reroutes >= MAX_REROUTES) {
      throw new Error("Co-Pilot exceeded maximum reroute attempts.");
    }

    const blockedList = [...blockedEdges].map((key) => {
      const [a, b] = key.split("|") as [string, string];
      return [a, b] as [string, string];
    });

    const segment = findShortestRoute(
      universe,
      geometry,
      current,
      intent.destination_id,
      { blockedEdges: blockedList },
    );

    if (!segment.deliverable || segment.path.length < 2) {
      throw new Error(
        segment.reason ??
          `Cannot reach ${intent.destination_id} from ${current} after ${reroutes} reroute(s).`,
      );
    }

    const next = segment.path[1]!;
    const hop = segment.hops[0]!;
    const linkId = canonicalLinkId(current, next);
    const linkState =
      chimeraClient.getLinkState(linkId) ??
      neutralLinkState(current, next, capacityByLinkId.get(linkId) ?? 100);

    const scored = evaluateLink(linkState, hop.void.total_ms);
    if (scored.blocked) {
      blockedEdges.add(edgeKey(current, next));
      reroutes += 1;
      continue;
    }

    if (scored.anomaly && scored.anomalyReason) {
      anomalies.push(`${scored.evaluation.link_id} (${scored.anomalyReason})`);
    }

    evaluations.push(scored.evaluation);
    current = next;
    path.push(current);
  }

  const physicsLatency = computePhysicsLatencyForPath(universe, geometry, path);
  const blockedLinkIds = [...blockedEdges].map((key) => key.replace("|", "-"));
  const congested = evaluations.filter(
    (evaluation) => evaluation.predicted_congestion_penalty_ms > 0,
  );
  const divergedFromBaseline =
    baselinePath.length > 0 && baselinePath.join("|") !== path.join("|");

  const explanationParts = [
    `Co-Pilot routed "${intent.payload || "(no payload)"}" from ${intent.origin_id} to ${intent.destination_id} via ${formatPathExplanation(path)} (parsed by ${intent.source} layer).`,
    baselinePath.length > 0
      ? `Baseline physics path was ${formatPathExplanation(baselinePath)}.`
      : "No baseline physics path was available.",
    reroutes > 0
      ? `Sequential evaluation triggered ${reroutes} reroute(s); blocked hops: ${blockedLinkIds.join(", ") || "none"}.`
      : "Baseline physics path remained safe after sequential link evaluation.",
    divergedFromBaseline
      ? "Final path diverged from the baseline to avoid unsafe links."
      : "Final path matched the physics baseline.",
    congested.length > 0
      ? `Congestion penalties applied on ${congested.map((evaluation) => evaluation.link_id).join(", ")}.`
      : "No significant congestion penalties on the final path.",
    anomalies.length > 0
      ? `Anomaly detected on ${anomalies.join(", ")}; routing conservatively (low trust, high risk) on out-of-distribution telemetry.`
      : "All link telemetry was within expected distribution.",
  ];

  return buildRoutingReport({
    origin_id: intent.origin_id,
    destination_id: intent.destination_id,
    path,
    link_evaluations: evaluations,
    physics_latency_ms: physicsLatency,
    explanation: explanationParts.join(" "),
  });
}
