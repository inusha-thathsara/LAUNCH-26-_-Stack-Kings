/**
 * Lowest-latency routing for the Relic Ring Protocol.
 *
 * The internal crust transit Tp at a planet depends on both the tower where the
 * packet entered (decided by the incoming hop) and the tower it leaves from
 * (decided by the outgoing hop). This is a turn-dependent cost, so a plain
 * node-weighted Dijkstra would be wrong. We instead run Dijkstra over an
 * expanded state space where each state is (planet, entryTower); the Tp of a
 * planet is charged when we leave it, using the known entry tower and the exit
 * tower implied by the next hop.
 *
 * Origin and destination each touch a single tower (entry === exit, s = 0), so
 * they are charged exactly one tower-processing delay.
 */

import type { GeometryProvider } from "./contracts";
import {
  combineRouteLatency,
  computeInternalLatency,
  computeVoidLatency,
  type InternalLatency,
  type VoidLatency,
} from "./latency";
import { edgeKey } from "./graph";
import type { LatencyBreakdown, PlanetNode, Universe } from "./types";

/** Internal crust transit at one visited planet. */
export interface RouteStep {
  planet_id: string;
  entry_tower: number;
  exit_tower: number;
  internal: InternalLatency;
}

/** A void hop between two consecutive planets along the route. */
export interface RouteHop {
  from: string;
  to: string;
  /** Sending tower on `from` (line-of-sight closest pair). */
  origin_tower: number;
  /** Receiving tower on `to` (line-of-sight closest pair). */
  destination_tower: number;
  void: VoidLatency;
}

/** Result of a routing query. */
export interface Route {
  origin_id: string;
  destination_id: string;
  deliverable: boolean;
  /** Populated when deliverable is false. */
  reason?: string;
  /** Ordered planet ids from origin to destination. */
  path: string[];
  /** Per-planet internal transit details, in path order. */
  steps: RouteStep[];
  /** Per-hop void details, in path order. */
  hops: RouteHop[];
  /** Route-level component breakdown (fiber, towers, atmosphere, void). */
  breakdown: LatencyBreakdown;
  /** Total end-to-end latency in ms (0 when undeliverable). */
  total_latency_ms: number;
}

/** Optional constraints for resilience / dynamic rerouting. */
export interface RouteOptions {
  /** Planet ids treated as dead (skipped entirely). */
  blockedNodes?: Iterable<string>;
  /** Undirected planet pairs treated as severed links. */
  blockedEdges?: Iterable<[string, string]>;
}

const NO_ENTRY = -1;

interface QueueEntry {
  key: string;
  dist: number;
}

/** Minimal binary min-heap keyed by `dist`. */
class MinHeap {
  private readonly items: QueueEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: QueueEntry): void {
    this.items.push(entry);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): QueueEntry | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top === undefined) return undefined;
    if (this.items.length > 0 && last !== undefined) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].dist <= this.items[i].dist) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  private bubbleDown(index: number): void {
    const n = this.items.length;
    let i = index;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.items[left].dist < this.items[smallest].dist) {
        smallest = left;
      }
      if (right < n && this.items[right].dist < this.items[smallest].dist) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [
        this.items[i],
        this.items[smallest],
      ];
      i = smallest;
    }
  }
}

function stateKey(planetId: string, entryTower: number): string {
  return `${planetId}#${entryTower}`;
}

interface PrevRecord {
  fromKey: string;
  step: RouteStep;
  hop: RouteHop;
}

function emptyBreakdown(): LatencyBreakdown {
  return {
    fiber_ms: 0,
    tower_ms: 0,
    atmosphere_ms: 0,
    void_ms: 0,
    total_ms: 0,
  };
}

function undeliverable(
  originId: string,
  destinationId: string,
  reason: string,
): Route {
  return {
    origin_id: originId,
    destination_id: destinationId,
    deliverable: false,
    reason,
    path: [],
    steps: [],
    hops: [],
    breakdown: emptyBreakdown(),
    total_latency_ms: 0,
  };
}

/**
 * Find the lowest-latency route from origin to destination, enforcing the Lmax
 * single-hop limit and honoring any blocked nodes/links.
 *
 * @throws {Error} when origin or destination id does not exist in the universe.
 */
export function findShortestRoute(
  universe: Universe,
  geometry: GeometryProvider,
  originId: string,
  destinationId: string,
  options: RouteOptions = {},
): Route {
  const origin = universe.nodesById.get(originId);
  const destination = universe.nodesById.get(destinationId);
  if (!origin) throw new Error(`Unknown origin planet "${originId}".`);
  if (!destination) {
    throw new Error(`Unknown destination planet "${destinationId}".`);
  }

  const { metadata } = universe;
  const lmax = metadata.max_void_hop_distance_km;
  const blockedNodes = new Set(options.blockedNodes ?? []);
  const blockedEdges = new Set<string>();
  for (const [a, b] of options.blockedEdges ?? []) {
    blockedEdges.add(edgeKey(a, b));
  }

  if (blockedNodes.has(originId)) {
    return undeliverable(originId, destinationId, `Origin "${originId}" is offline.`);
  }
  if (blockedNodes.has(destinationId)) {
    return undeliverable(
      originId,
      destinationId,
      `Destination "${destinationId}" is offline.`,
    );
  }

  // Trivial route: already at the destination.
  if (originId === destinationId) {
    const internal = computeInternalLatency(origin, 0, 0, geometry, metadata);
    const steps: RouteStep[] = [
      { planet_id: originId, entry_tower: 0, exit_tower: 0, internal },
    ];
    const breakdown = combineRouteLatency([internal], []);
    return {
      origin_id: originId,
      destination_id: destinationId,
      deliverable: true,
      path: [originId],
      steps,
      hops: [],
      breakdown,
      total_latency_ms: breakdown.total_ms,
    };
  }

  const reachable = (a: PlanetNode, b: PlanetNode): boolean => {
    if (blockedNodes.has(b.id)) return false;
    if (blockedEdges.has(edgeKey(a.id, b.id))) return false;
    return geometry.voidDistanceKm(a, b) <= lmax;
  };

  const dist = new Map<string, number>();
  const prev = new Map<string, PrevRecord>();
  const heap = new MinHeap();

  const startKey = stateKey(originId, NO_ENTRY);
  dist.set(startKey, 0);
  heap.push({ key: startKey, dist: 0 });

  let finalKey: string | undefined;

  while (heap.size > 0) {
    const current = heap.pop()!;
    const bestKnown = dist.get(current.key);
    if (bestKnown === undefined || current.dist > bestKnown) {
      continue; // stale heap entry
    }

    const [planetId, entryRaw] = splitKey(current.key);
    if (planetId === destinationId) {
      finalKey = current.key;
      break; // first popped destination state is optimal
    }

    const planet = universe.nodesById.get(planetId)!;
    const entryTower = entryRaw;

    for (const neighbor of universe.nodes) {
      if (neighbor.id === planetId) continue;
      if (!reachable(planet, neighbor)) continue;

      const pair = geometry.closestTowerPair(planet, neighbor);
      const exitTower = pair.origin_tower;
      // Origin has no incoming hop, so it leaves from its sending tower (s = 0).
      const effectiveEntry = entryTower === NO_ENTRY ? exitTower : entryTower;

      const internal = computeInternalLatency(
        planet,
        effectiveEntry,
        exitTower,
        geometry,
        metadata,
      );
      const voidLatency = computeVoidLatency(
        planet,
        neighbor,
        geometry,
        metadata,
      );

      const nextDist = current.dist + internal.total_ms + voidLatency.total_ms;
      const nextKey = stateKey(neighbor.id, pair.destination_tower);

      const knownNext = dist.get(nextKey);
      if (knownNext === undefined || nextDist < knownNext) {
        dist.set(nextKey, nextDist);
        prev.set(nextKey, {
          fromKey: current.key,
          step: {
            planet_id: planetId,
            entry_tower: effectiveEntry,
            exit_tower: exitTower,
            internal,
          },
          hop: {
            from: planetId,
            to: neighbor.id,
            origin_tower: exitTower,
            destination_tower: pair.destination_tower,
            void: voidLatency,
          },
        });
        heap.push({ key: nextKey, dist: nextDist });
      }
    }
  }

  if (finalKey === undefined) {
    return undeliverable(
      originId,
      destinationId,
      `No route from "${originId}" to "${destinationId}" within Lmax (${lmax} km).`,
    );
  }

  // Reconstruct the path from destination back to origin.
  const steps: RouteStep[] = [];
  const hops: RouteHop[] = [];
  let cursor = finalKey;
  while (prev.has(cursor)) {
    const record = prev.get(cursor)!;
    steps.push(record.step);
    hops.push(record.hop);
    cursor = record.fromKey;
  }
  steps.reverse();
  hops.reverse();

  // The destination touches a single tower (s = 0): charge one tower delay.
  const [, destEntry] = splitKey(finalKey);
  const destInternal = computeInternalLatency(
    destination,
    destEntry,
    destEntry,
    geometry,
    metadata,
  );
  steps.push({
    planet_id: destinationId,
    entry_tower: destEntry,
    exit_tower: destEntry,
    internal: destInternal,
  });

  const breakdown = combineRouteLatency(
    steps.map((s) => s.internal),
    hops.map((h) => h.void),
  );

  return {
    origin_id: originId,
    destination_id: destinationId,
    deliverable: true,
    path: steps.map((s) => s.planet_id),
    steps,
    hops,
    breakdown,
    total_latency_ms: breakdown.total_ms,
  };
}

function splitKey(key: string): [string, number] {
  const hash = key.lastIndexOf("#");
  return [key.slice(0, hash), Number(key.slice(hash + 1))];
}
