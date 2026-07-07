import { describe, expect, it } from "vitest";

import { ResilientNetwork } from "./resilience";
import { createStubCodec } from "./stubs/codec.stub";
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

const geometry = createStubGeometryProvider(metadata);
const codec = createStubCodec();

// Diamond: A connects to B and D; both B and D connect to C.
// A-C is too far for a direct hop, so there are two 2-hop routes (via B, via D).
function diamond(): Universe {
  return universe([
    node("A", 0, 0),
    node("B", 8, 5),
    node("C", 16, 0),
    node("D", 8, -5),
  ]);
}

describe("ResilientNetwork", () => {
  it("reroutes around a killed node without losing data (M4)", () => {
    const net = new ResilientNetwork(diamond(), geometry, codec);

    const before = net.send("A", "C", "Hello world");
    expect(before.packet.status).toBe("delivered");
    expect(before.delivered_payload).toBe("Hello world");

    net.killNode("B");

    const after = net.send("A", "C", "Hello world");
    expect(after.packet.status).toBe("delivered");
    expect(after.delivered_payload).toBe("Hello world");
    expect(after.route.path).not.toContain("B");
    expect(after.route.path).toContain("D");
  });

  it("reroutes around a severed link", () => {
    const net = new ResilientNetwork(diamond(), geometry, codec);
    net.killLink("A", "B");

    const route = net.route("A", "C");
    expect(route.deliverable).toBe(true);
    expect(route.path).not.toContain("B");
  });

  it("reports undeliverable when the destination becomes isolated", () => {
    // Line A-B-C: B is the only bridge to C.
    const line = universe([node("A", 0, 0), node("B", 10, 0), node("C", 20, 0)]);
    const net = new ResilientNetwork(line, geometry, codec);

    expect(net.route("A", "C").deliverable).toBe(true);

    net.killNode("B");
    const result = net.send("A", "C", "Hello world");
    expect(result.packet.status).toBe("undeliverable");
    expect(result.delivered_payload).toBeNull();
  });

  it("restores routing after reviving a node", () => {
    const line = universe([node("A", 0, 0), node("B", 10, 0), node("C", 20, 0)]);
    const net = new ResilientNetwork(line, geometry, codec);

    net.killNode("B");
    expect(net.route("A", "C").deliverable).toBe(false);

    net.reviveNode("B");
    expect(net.route("A", "C").deliverable).toBe(true);
  });

  it("tracks and clears failure state", () => {
    const net = new ResilientNetwork(diamond(), geometry, codec);
    net.killNode("B");
    net.killLink("A", "D");

    let status = net.status();
    expect(status.failed_nodes).toEqual(["B"]);
    expect(status.failed_links).toEqual([["A", "D"]]);
    expect(net.isNodeFailed("B")).toBe(true);
    expect(net.isLinkFailed("D", "A")).toBe(true); // order-independent

    net.reset();
    status = net.status();
    expect(status.failed_nodes).toHaveLength(0);
    expect(status.failed_links).toHaveLength(0);
  });

  it("throws when killing an unknown planet", () => {
    const net = new ResilientNetwork(diamond(), geometry, codec);
    expect(() => net.killNode("Nope")).toThrow(/Unknown planet/);
    expect(() => net.killLink("A", "Nope")).toThrow(/Unknown planet/);
  });
});
