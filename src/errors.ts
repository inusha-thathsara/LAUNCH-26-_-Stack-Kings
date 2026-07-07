/**
 * Resilience and dynamic rerouting for the Relic Ring Protocol.
 *
 * Wraps the universe in a stateful controller that tracks node and link
 * failures. Because routing is recomputed on every send against the current
 * failure set, packets are instantly routed around "dead zones" without data
 * loss whenever an alternative path exists, and reported undeliverable when the
 * destination becomes isolated. This drives the M4 chaos demonstration.
 */

import type { Codec, GeometryProvider } from "./contracts";
import { edgeKey } from "./graph";
import { findShortestRoute, type Route, type RouteOptions } from "./router";
import { transmit, type TransmissionResult } from "./transmission";
import type { Universe } from "./types";

/** Snapshot of the current failure state of the network. */
export interface NetworkStatus {
  failed_nodes: string[];
  failed_links: Array<[string, string]>;
}

/** A live, failure-aware view of the network for routing and transmission. */
export class ResilientNetwork {
  private readonly failedNodes = new Set<string>();
  private readonly failedLinks = new Map<string, [string, string]>();

  constructor(
    private readonly universe: Universe,
    private readonly geometry: GeometryProvider,
    private readonly codec: Codec,
  ) {}

  /** Mark a planet as offline; subsequent routes avoid it entirely. */
  killNode(id: string): void {
    this.assertNode(id);
    this.failedNodes.add(id);
  }

  /** Bring a previously failed planet back online. */
  reviveNode(id: string): void {
    this.assertNode(id);
    this.failedNodes.delete(id);
  }

  /** Sever the direct link between two planets (both directions). */
  killLink(a: string, b: string): void {
    this.assertNode(a);
    this.assertNode(b);
    this.failedLinks.set(edgeKey(a, b), [a, b]);
  }

  /** Restore a previously severed link. */
  reviveLink(a: string, b: string): void {
    this.assertNode(a);
    this.assertNode(b);
    this.failedLinks.delete(edgeKey(a, b));
  }

  /** Clear all node and link failures. */
  reset(): void {
    this.failedNodes.clear();
    this.failedLinks.clear();
  }

  isNodeFailed(id: string): boolean {
    return this.failedNodes.has(id);
  }

  isLinkFailed(a: string, b: string): boolean {
    return this.failedLinks.has(edgeKey(a, b));
  }

  /** Current failure snapshot (useful for visualization / status panels). */
  status(): NetworkStatus {
    return {
      failed_nodes: [...this.failedNodes],
      failed_links: [...this.failedLinks.values()],
    };
  }

  /** Compute the lowest-latency route given the current failures. */
  route(originId: string, destinationId: string): Route {
    return findShortestRoute(
      this.universe,
      this.geometry,
      originId,
      destinationId,
      this.currentOptions(),
    );
  }

  /** Transmit a payload given the current failures, rerouting as needed. */
  send(
    originId: string,
    destinationId: string,
    payload: string,
  ): TransmissionResult {
    return transmit(
      this.universe,
      this.geometry,
      this.codec,
      originId,
      destinationId,
      payload,
      this.currentOptions(),
    );
  }

  private currentOptions(): RouteOptions {
    return {
      blockedNodes: [...this.failedNodes],
      blockedEdges: [...this.failedLinks.values()],
    };
  }

  private assertNode(id: string): void {
    if (!this.universe.nodesById.has(id)) {
      throw new Error(`Unknown planet "${id}".`);
    }
  }
}
