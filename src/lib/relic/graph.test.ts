import { describe, expect, it } from "vitest";

import { buildNetworkGraph, edgeKey } from "./graph";
import { createStubGeometryProvider } from "./stubs/geometry.stub";
import type { PlanetNode, Universe, UniverseMetadata } from "./types";

const metadata: UniverseMetadata = {
  system_name: "Test",
  speed_of_light_kms: 300000,
  max_void_hop_distance_km: 10, // km
  coordinate_scale_unit_km: 1,
  tower_processing_delay_ms: 7,
  fiber_speed_fraction: 0.67,
};

function node(id: string, x: number, y: number): PlanetNode {
  return {
    id,
    codex: 10,
    x,
    y,
    radius_km: 1,
    active_towers: 4,
    atmosphere_thickness_km: 0,
    refraction_index: 1,
  };
}

function universe(nodes: PlanetNode[]): Universe {
  return {
    metadata,
    nodes,
    nodesById: new Map(nodes.map((n) => [n.id, n])),
  };
}

describe("edgeKey", () => {
  it("is order-independent", () => {
    expect(edgeKey("A", "B")).toBe(edgeKey("B", "A"));
  });
});

describe("buildNetworkGraph", () => {
  // A--B--C are 10 units apart in a line (scale 1). L = 10 - 1 - 1 = 8 <= Lmax.
  // A--C are 20 units apart. L = 18 > Lmax, so no direct edge.
  const a = node("A", 0, 0);
  const b = node("B", 10, 0);
  const c = node("C", 20, 0);
  const geometry = createStubGeometryProvider(metadata);

  it("links only planet pairs within Lmax", () => {
    const graph = buildNetworkGraph(universe([a, b, c]), geometry);
    expect(graph.adjacency.get("A")).toEqual(["B"]);
    expect(graph.adjacency.get("B")?.sort()).toEqual(["A", "C"]);
    expect(graph.adjacency.get("C")).toEqual(["B"]);
  });

  it("records every candidate pair with reachability metadata", () => {
    const graph = buildNetworkGraph(universe([a, b, c]), geometry);
    expect(graph.edges).toHaveLength(3); // A-B, A-C, B-C

    const ac = graph.edges.find((e) => edgeKey(e.from, e.to) === edgeKey("A", "C"));
    expect(ac?.within_lmax).toBe(false);
    expect(ac?.void_distance_km).toBeCloseTo(18, 6);

    const ab = graph.edges.find((e) => edgeKey(e.from, e.to) === edgeKey("A", "B"));
    expect(ab?.within_lmax).toBe(true);
    expect(ab?.void_distance_km).toBeCloseTo(8, 6);
  });

  it("treats L == Lmax as reachable (inclusive)", () => {
    // Distance 12 units -> L = 12 - 1 - 1 = 10 == Lmax.
    const graph = buildNetworkGraph(
      universe([node("A", 0, 0), node("B", 12, 0)]),
      geometry,
    );
    expect(graph.adjacency.get("A")).toEqual(["B"]);
  });
});
