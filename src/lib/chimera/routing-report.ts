/**
 * Shared helpers for building Phase 2 routing reports.
 */

import { edgeKey } from "../relic/graph";
import { findShortestRoute, type Route } from "../relic/router";
import type { GeometryProvider } from "../relic/contracts";
import type { Universe } from "../relic/types";
import type { ChimeraLinkState, LinkEvaluation, Phase2RoutingReport } from "./types";
import { canonicalLinkId } from "./link-id";
import { evaluateLink, neutralLinkState } from "./link-evaluation";

export function buildBlockedEdgesExceptPath(
  universe: Universe,
  geometry: GeometryProvider,
  path: string[],
): [string, string][] {
  const allowed = new Set<string>();
  for (let i = 0; i < path.length - 1; i += 1) {
    allowed.add(edgeKey(path[i]!, path[i + 1]!));
  }

  const blocked: [string, string][] = [];
  for (let i = 0; i < universe.nodes.length; i += 1) {
    for (let j = i + 1; j < universe.nodes.length; j += 1) {
      const a = universe.nodes[i]!;
      const b = universe.nodes[j]!;
      const key = edgeKey(a.id, b.id);
      if (
        !allowed.has(key) &&
        geometry.voidDistanceKm(a, b) <= universe.metadata.max_void_hop_distance_km
      ) {
        blocked.push([a.id, b.id]);
      }
    }
  }
  return blocked;
}

export function computePhysicsLatencyForPath(
  universe: Universe,
  geometry: GeometryProvider,
  path: string[],
): number {
  if (path.length === 0) return 0;
  if (path.length === 1) {
    const route = findShortestRoute(universe, geometry, path[0]!, path[0]!);
    return route.total_latency_ms;
  }

  const blockedEdges = buildBlockedEdgesExceptPath(universe, geometry, path);
  const route = findShortestRoute(
    universe,
    geometry,
    path[0]!,
    path[path.length - 1]!,
    { blockedEdges },
  );
  if (!route.deliverable || route.path.join("|") !== path.join("|")) {
    throw new Error("Could not reconstruct physics latency for the chosen path.");
  }
  return route.total_latency_ms;
}

export function evaluatePathLinks(
  route: Route,
  linkStateById: Map<string, ChimeraLinkState>,
  capacityByLinkId: Map<string, number>,
): LinkEvaluation[] {
  return route.hops.map((hop) => {
    const linkId = canonicalLinkId(hop.from, hop.to);
    const linkState =
      linkStateById.get(linkId) ??
      neutralLinkState(hop.from, hop.to, capacityByLinkId.get(linkId) ?? 100);
    return evaluateLink(linkState, hop.void.total_ms).evaluation;
  });
}

export function buildRoutingReport(params: {
  origin_id: string;
  destination_id: string;
  path: string[];
  link_evaluations: LinkEvaluation[];
  physics_latency_ms: number;
  explanation: string;
}): Phase2RoutingReport {
  const congestionSum = params.link_evaluations.reduce(
    (sum, evaluation) => sum + evaluation.predicted_congestion_penalty_ms,
    0,
  );

  return {
    origin_id: params.origin_id,
    destination_id: params.destination_id,
    chosen_path: params.path,
    link_evaluations: params.link_evaluations,
    final_latency_estimate_ms:
      Math.round((params.physics_latency_ms + congestionSum) * 1000) / 1000,
    explanation: params.explanation,
  };
}

export function formatPathExplanation(path: string[]): string {
  return path.join(" → ");
}
