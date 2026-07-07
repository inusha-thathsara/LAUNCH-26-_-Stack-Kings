/**
 * True-Cost router.
 *
 * Wraps the Phase 1 `findShortestRoute` baseline but adds dynamic per-link
 * surcharges computed from the three analytical sub-models.
 *
 * True Cost formula per candidate link:
 *   combined_cost = physics_void_ms
 *                 + predicted_congestion_penalty_ms
 *                 + trust_penalty_ms
 *                 + targeting_penalty_ms
 *                 + entropy_bonus_ms
 *
 * If is_saturated OR trust_score < TRUST_FLOOR → link treated as blocked.
 *
 * Route diversification: among paths whose True Cost is within
 * ROUTE_DIVERSIFICATION_EPSILON of the optimal, the one with the lowest
 * aggregate targeting risk is chosen (entropy maximisation).
 */

import { edgeKey } from "../../relic/graph";
import { computeVoidLatency } from "../../relic/latency";
import { findShortestRoute, type Route } from "../../relic/router";
import { getEngine } from "../../relic/server/universe";
import type { LinkEvaluation, Phase2RoutingReport } from "../types";
import { canonicalLinkId } from "../link-id";
import { chimeraClient } from "../client";
import { detectLinkAnomaly, evaluateLink, neutralLinkState } from "../link-evaluation";
import { ROUTE_DIVERSIFICATION_EPSILON } from "../constants";
import {
  buildRoutingReport,
  computePhysicsLatencyForPath,
  evaluatePathLinks,
  formatPathExplanation,
} from "../routing-report";

export interface TrueCostRouteOptions {
  origin_id: string;
  destination_id: string;
  payload?: string;
}

interface RouteCandidate {
  route: Route;
  evaluations: LinkEvaluation[];
  trueCostSum: number;
  targetingSum: number;
}

/**
 * Find the best route using True Cost weights and return a Council-schema report.
 */
export async function routeWithTrueCost(
  options: TrueCostRouteOptions,
): Promise<Phase2RoutingReport> {
  const { universe, geometry } = getEngine();
  const state = await chimeraClient.getState();
  const linkStateById = new Map(state.links.map((link) => [link.link_id, link]));
  const capacityByLinkId = new Map(
    universe.interplanetaryLinks.map((link) => [link.link_id, link.capacity_units]),
  );

  const hardBlocked = new Set<string>();
  for (const linkState of state.links) {
    const planetA = universe.nodesById.get(linkState.planet_a);
    const planetB = universe.nodesById.get(linkState.planet_b);
    if (!planetA || !planetB) continue;

    const physicsVoidMs = computeVoidLatency(
      planetA,
      planetB,
      geometry,
      universe.metadata,
    ).total_ms;
    const scored = evaluateLink(linkState, physicsVoidMs);
    if (scored.blocked) {
      hardBlocked.add(edgeKey(linkState.planet_a, linkState.planet_b));
    }
  }

  const surcharge = (from: string, to: string, physicsVoidMs: number): number => {
    const linkId = canonicalLinkId(from, to);
    const linkState =
      linkStateById.get(linkId) ??
      neutralLinkState(from, to, capacityByLinkId.get(linkId) ?? 100);
    const scored = evaluateLink(linkState, physicsVoidMs);
    if (scored.blocked) return Number.POSITIVE_INFINITY;
    return scored.evaluation.combined_cost - physicsVoidMs;
  };

  const buildCandidate = (extraBlocked: Set<string>): RouteCandidate | undefined => {
    const blockedEdges = new Set<string>([...hardBlocked, ...extraBlocked]);
    const route = findShortestRoute(
      universe,
      geometry,
      options.origin_id,
      options.destination_id,
      {
        blockedEdges: [...blockedEdges].map(
          (key) => key.split("|") as [string, string],
        ),
        voidHopSurchargeMs: surcharge,
      },
    );
    if (!route.deliverable) return undefined;

    const evaluations = evaluatePathLinks(route, linkStateById, capacityByLinkId);
    const physicsLatency = computePhysicsLatencyForPath(universe, geometry, route.path);
    const penaltySum = route.hops.reduce((sum, hop, index) => {
      const evaluation = evaluations[index]!;
      return sum + (evaluation.combined_cost - hop.void.total_ms);
    }, 0);
    const targetingSum = evaluations.reduce(
      (sum, e) => sum + e.targeting_risk_score,
      0,
    );

    return {
      route,
      evaluations,
      trueCostSum: physicsLatency + penaltySum,
      targetingSum,
    };
  };

  const optimal = buildCandidate(new Set());
  if (!optimal) {
    throw new Error(
      `No deliverable True Cost route from ${options.origin_id} to ${options.destination_id}.`,
    );
  }

  // Diversification: block each used link once and keep near-optimal alternatives.
  const threshold = optimal.trueCostSum * (1 + ROUTE_DIVERSIFICATION_EPSILON);
  let chosen = optimal;
  let diversified = false;

  for (const hop of optimal.route.hops) {
    const candidate = buildCandidate(new Set([edgeKey(hop.from, hop.to)]));
    if (!candidate) continue;
    if (candidate.trueCostSum > threshold) continue;
    if (
      candidate.targetingSum < chosen.targetingSum - 1e-9 ||
      (Math.abs(candidate.targetingSum - chosen.targetingSum) < 1e-9 &&
        candidate.trueCostSum < chosen.trueCostSum)
    ) {
      chosen = candidate;
      diversified =
        diversified || candidate.route.path.join("|") !== optimal.route.path.join("|");
    }
  }

  const physicsLatency = computePhysicsLatencyForPath(
    universe,
    geometry,
    chosen.route.path,
  );
  const riskyLinks = chosen.evaluations
    .filter((evaluation) => evaluation.targeting_risk_score >= 0.5)
    .map((evaluation) => evaluation.link_id);

  const anomalies: string[] = [];
  for (const hop of chosen.route.hops) {
    const linkId = canonicalLinkId(hop.from, hop.to);
    const linkState = linkStateById.get(linkId);
    if (!linkState) continue;
    const anomaly = detectLinkAnomaly(linkState);
    if (anomaly.anomalous) {
      anomalies.push(`${linkId} (${anomaly.reasons.join("; ")})`);
    }
  }

  const explanationParts = [
    `True Cost route from ${options.origin_id} to ${options.destination_id}: ${formatPathExplanation(chosen.route.path)}.`,
    hardBlocked.size > 0
      ? `Avoided ${hardBlocked.size} blocked link(s) (saturated or low trust).`
      : "No links were hard-blocked this tick.",
    diversified
      ? "Selected a near-optimal path with lower aggregate targeting risk (route diversification)."
      : "Chosen path was also the lowest True Cost path.",
    riskyLinks.length > 0
      ? `Elevated targeting risk on: ${riskyLinks.join(", ")}.`
      : "Targeting risk remained moderate on all hops.",
    anomalies.length > 0
      ? `Anomaly detected on ${anomalies.join(", ")}; routed conservatively on out-of-distribution telemetry.`
      : "All link telemetry was within expected distribution.",
  ];
  if (options.payload) {
    explanationParts.push(`Payload length: ${options.payload.length} characters.`);
  }

  return buildRoutingReport({
    origin_id: options.origin_id,
    destination_id: options.destination_id,
    path: chosen.route.path,
    link_evaluations: chosen.evaluations,
    physics_latency_ms: physicsLatency,
    explanation: explanationParts.join(" "),
  });
}
