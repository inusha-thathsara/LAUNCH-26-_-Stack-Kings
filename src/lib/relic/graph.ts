/**
 * Network graph construction for the Relic Ring Protocol.
 *
 * Builds the set of possible void hops between planets. A direct hop is only
 * allowed when the void distance L does not exceed Lmax
 * (max_void_hop_distance_km); longer gaps must be bridged through intermediate
 * planets, and if nothing bridges them the route is undeliverable.
 */

import type { GeometryProvider } from "./contracts";
import type { Universe } from "./types";

/** A candidate void hop between two planets, with reachability metadata. */
export interface VoidEdge {
  from: string;
  to: string;
  /** Center-based void distance L, in km. */
  void_distance_km: number;
  /** True when L <= Lmax, i.e. a direct laser hop is possible. */
  within_lmax: boolean;
}

/** The universe topology derived from geometry and the Lmax constraint. */
export interface NetworkGraph {
  /** planet id -> ids reachable via a single direct hop (L <= Lmax). */
  adjacency: Map<string, string[]>;
  /** Every unordered planet pair with distance + reachability metadata. */
  edges: VoidEdge[];
}

/** Stable key for an undirected planet pair. */
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Build the network graph for a universe. Distances come from the geometry
 * provider (mapping teammate); the Lmax threshold comes from metadata.
 */
export function buildNetworkGraph(
  universe: Universe,
  geometry: GeometryProvider,
): NetworkGraph {
  const { nodes, metadata } = universe;
  const lmax = metadata.max_void_hop_distance_km;

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  const edges: VoidEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const voidDistanceKm = geometry.voidDistanceKm(a, b);
      const withinLmax = voidDistanceKm <= lmax;

      edges.push({
        from: a.id,
        to: b.id,
        void_distance_km: voidDistanceKm,
        within_lmax: withinLmax,
      });

      if (withinLmax) {
        adjacency.get(a.id)!.push(b.id);
        adjacency.get(b.id)!.push(a.id);
      }
    }
  }

  return { adjacency, edges };
}
