import { describe, expect, it } from "vitest";

import { createStubCodec } from "./stubs/codec.stub";
import { createStubGeometryProvider } from "./stubs/geometry.stub";
import { transmit } from "./transmission";
import type { PlanetNode, Universe, UniverseMetadata } from "./types";

const metadata: UniverseMetadata = {
  system_name: "Test",
  speed_of_light_kms: 300000,
  max_void_hop_distance_km: 10, // km
  coordinate_scale_unit_km: 1,
  tower_processing_delay_ms: 7,
  fiber_speed_fraction: 0.67,
};

function node(id: string, x: number, codex: number): PlanetNode {
  return {
    id,
    codex,
    x,
    y: 0,
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

// Matches the challenge example: A (base 8) -> B (base 5) -> C (base 14).
// A-C exceeds Lmax (18 > 10) so the packet must relay through B.
const A = node("A", 0, 8);
const B = node("B", 10, 5);
const C = node("C", 20, 14);

describe("transmit", () => {
  it("delivers 'Hello world' across a multi-hop route (M2)", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "C", "Hello world");

    expect(result.packet.status).toBe("delivered");
    expect(result.packet.current_id).toBe("C");
    expect(result.packet.origin_id).toBe("A");
    expect(result.packet.destination_id).toBe("C");
    expect(result.delivered_payload).toBe("Hello world");
    expect(result.route.path).toEqual(["A", "B", "C"]);
  });

  it("records each planet's payload in its own dialect, matching the spec", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "C", "Hello world");
    const [entryA, entryB, entryC] = result.packet.hop_log;

    expect(result.packet.hop_log).toHaveLength(3);

    // Planet A in base 8 (octal of the ASCII bytes).
    expect(entryA.planet_id).toBe("A");
    expect(entryA.codex).toBe(8);
    expect(entryA.payload_dialect.base).toBe(8);

    // Planet B in base 5 — the exact sequence from the challenge.
    expect(entryB.planet_id).toBe("B");
    expect(entryB.payload_dialect.base).toBe(5);
    expect(entryB.payload_dialect.digits).toEqual([
      "242", "401", "413", "413", "421", "112", "434", "421", "424", "413", "400",
    ]);

    // Planet C in base 14 — the exact sequence from the challenge.
    expect(entryC.planet_id).toBe("C");
    expect(entryC.payload_dialect.base).toBe(14);
    expect(entryC.payload_dialect.digits).toEqual([
      "52", "73", "7A", "7A", "7D", "24", "87", "7D", "82", "7A", "72",
    ]);
  });

  it("keeps the ASCII payload intact at every hop", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "C", "Hello world");
    const expectedAscii = [72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100];
    for (const entry of result.packet.hop_log) {
      expect(entry.payload_ascii).toEqual(expectedAscii);
    }
  });

  it("links each non-final entry to the next hop and terminates cleanly", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "C", "Hello world");
    const [entryA, entryB, entryC] = result.packet.hop_log;

    expect(entryA.next_hop_id).toBe("B");
    expect(entryA.void_latency_ms).toBeGreaterThan(0);
    expect(entryB.next_hop_id).toBe("C");
    expect(entryC.next_hop_id).toBeUndefined();
    expect(entryC.void_latency_ms).toBeUndefined();
  });

  it("accumulates cumulative latency up to the route total", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "C", "Hello world");
    const last = result.packet.hop_log[result.packet.hop_log.length - 1];
    expect(last.cumulative_latency_ms).toBeCloseTo(result.route.total_latency_ms, 9);
  });

  it("marks a packet undeliverable when no route exists", () => {
    const far = node("Z", 1_000_000, 10);
    const result = transmit(universe([A, B, C, far]), geometry, codec, "A", "Z", "Hello world");

    expect(result.packet.status).toBe("undeliverable");
    expect(result.packet.hop_log).toHaveLength(0);
    expect(result.delivered_payload).toBeNull();
    expect(result.packet.undeliverable_reason).toMatch(/No route/);
    expect(result.packet.current_id).toBe("A");
  });

  it("handles a single-planet (origin === destination) transmission", () => {
    const result = transmit(universe([A, B, C]), geometry, codec, "A", "A", "Hi");
    expect(result.packet.status).toBe("delivered");
    expect(result.packet.hop_log).toHaveLength(1);
    expect(result.delivered_payload).toBe("Hi");
  });

  it("reroutes the payload when a node is blocked", () => {
    // With B alive, A->C works through B. Killing B makes it undeliverable here.
    const blocked = transmit(
      universe([A, B, C]),
      geometry,
      codec,
      "A",
      "C",
      "Hello world",
      { blockedNodes: ["B"] },
    );
    expect(blocked.packet.status).toBe("undeliverable");
  });
});
