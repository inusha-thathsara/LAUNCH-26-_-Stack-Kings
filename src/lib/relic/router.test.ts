import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseUniverseConfig } from "./config";
import { findShortestRoute } from "./router";
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

// A--B--C in a line; A-C exceeds Lmax so must hop through B.
const a = node("A", 0, 0);
const b = node("B", 10, 0);
const c = node("C", 20, 0);
const geometry = createStubGeometryProvider(metadata);

describe("findShortestRoute", () => {
  it("routes a direct hop when within Lmax", () => {
    const route = findShortestRoute(universe([a, b, c]), geometry, "A", "B");
    expect(route.deliverable).toBe(true);
    expect(route.path).toEqual(["A", "B"]);
    expect(route.hops).toHaveLength(1);
    expect(route.steps).toHaveLength(2);
  });

  it("bridges through an intermediate planet when a direct hop exceeds Lmax", () => {
    const route = findShortestRoute(universe([a, b, c]), geometry, "A", "C");
    expect(route.deliverable).toBe(true);
    expect(route.path).toEqual(["A", "B", "C"]);
    expect(route.hops).toHaveLength(2);
    expect(route.steps).toHaveLength(3);
  });

  it("charges one tower (s=0) at origin and destination", () => {
    const route = findShortestRoute(universe([a, b, c]), geometry, "A", "C");
    const origin = route.steps[0];
    const dest = route.steps[route.steps.length - 1];
    expect(origin.entry_tower).toBe(origin.exit_tower);
    expect(origin.internal.segments).toBe(0);
    expect(origin.internal.tower_ms).toBe(7);
    expect(dest.entry_tower).toBe(dest.exit_tower);
    expect(dest.internal.segments).toBe(0);
    expect(dest.internal.tower_ms).toBe(7);
  });

  it("keeps total latency consistent with the component breakdown", () => {
    const route = findShortestRoute(universe([a, b, c]), geometry, "A", "C");
    const summed =
      route.breakdown.fiber_ms +
      route.breakdown.tower_ms +
      route.breakdown.atmosphere_ms +
      route.breakdown.void_ms;
    expect(route.total_latency_ms).toBeCloseTo(summed, 9);
    expect(route.total_latency_ms).toBeGreaterThan(0);
  });

  it("returns a trivial route when origin equals destination", () => {
    const route = findShortestRoute(universe([a, b, c]), geometry, "A", "A");
    expect(route.deliverable).toBe(true);
    expect(route.path).toEqual(["A"]);
    expect(route.hops).toHaveLength(0);
    expect(route.total_latency_ms).toBe(7);
  });

  it("reports undeliverable when no path bridges the gap", () => {
    const far = node("Z", 1_000_000, 0);
    const route = findShortestRoute(universe([a, b, c, far]), geometry, "A", "Z");
    expect(route.deliverable).toBe(false);
    expect(route.path).toEqual([]);
    expect(route.reason).toMatch(/No route/);
  });

  it("reroutes around a blocked node", () => {
    const direct = findShortestRoute(universe([a, b, c]), geometry, "A", "C");
    expect(direct.deliverable).toBe(true);

    const blocked = findShortestRoute(universe([a, b, c]), geometry, "A", "C", {
      blockedNodes: ["B"],
    });
    expect(blocked.deliverable).toBe(false);
    expect(blocked.reason).toMatch(/No route/);
  });

  it("respects a blocked link", () => {
    const blocked = findShortestRoute(universe([a, b, c]), geometry, "A", "C", {
      blockedEdges: [["A", "B"]],
    });
    expect(blocked.deliverable).toBe(false);
  });

  it("throws on an unknown planet id", () => {
    expect(() =>
      findShortestRoute(universe([a, b, c]), geometry, "A", "Nope"),
    ).toThrow(/Unknown destination/);
    expect(() =>
      findShortestRoute(universe([a, b, c]), geometry, "Nope", "C"),
    ).toThrow(/Unknown origin/);
  });

  it("routes across the real Zeta-26 universe", () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "universe-config.json"), "utf8"),
    );
    const real = parseUniverseConfig(raw);
    const realGeometry = createStubGeometryProvider(real.metadata);

    const route = findShortestRoute(real, realGeometry, "Aegis", "Caelum");
    expect(route.deliverable).toBe(true);
    expect(route.path[0]).toBe("Aegis");
    expect(route.path[route.path.length - 1]).toBe("Caelum");
    expect(route.path.length).toBeGreaterThanOrEqual(2);
    expect(route.total_latency_ms).toBeGreaterThan(0);
  });
});
