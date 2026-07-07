import { describe, expect, it } from "vitest";

import {
  combineRouteLatency,
  computeInternalLatency,
  computeVoidLatency,
  type InternalLatency,
  type VoidLatency,
} from "./latency";
import { createStubGeometryProvider } from "./stubs/geometry.stub";
import type { PlanetNode, UniverseMetadata } from "./types";

const metadata: UniverseMetadata = {
  system_name: "Zeta-26",
  speed_of_light_kms: 300000,
  max_void_hop_distance_km: 50000000,
  coordinate_scale_unit_km: 100000,
  tower_processing_delay_ms: 7,
  fiber_speed_fraction: 0.67,
};

const geometry = createStubGeometryProvider(metadata);

const planet = (overrides: Partial<PlanetNode> = {}): PlanetNode => ({
  id: "P",
  codex: 10,
  x: 0,
  y: 0,
  radius_km: 1000,
  active_towers: 4,
  atmosphere_thickness_km: 50,
  refraction_index: 1.0,
  ...overrides,
});

describe("computeVoidLatency (Tv)", () => {
  it("matches hand-computed components for a 3-4-5 layout", () => {
    const a = planet({
      id: "A",
      x: 0,
      y: 0,
      radius_km: 1000,
      atmosphere_thickness_km: 50,
      refraction_index: 1.0,
    });
    const b = planet({
      id: "B",
      x: 3,
      y: 4,
      radius_km: 2000,
      atmosphere_thickness_km: 100,
      refraction_index: 2.0,
    });

    const result = computeVoidLatency(a, b, geometry, metadata);

    // S = 5 * 100000 = 500000; L = 500000 - (1000+50) - (2000+100) = 496850
    expect(result.void_distance_km).toBeCloseTo(496850, 6);
    // atmosphere = (50*1 + 100*2) / 300000 * 1000 = 0.833333...
    expect(result.atmosphere_ms).toBeCloseTo(0.8333333, 6);
    // void = 496850 / 300000 * 1000 = 1656.16666...
    expect(result.void_ms).toBeCloseTo(1656.1666667, 6);
    expect(result.total_ms).toBeCloseTo(1657.0, 6);
  });

  it("is symmetric in the two planets", () => {
    const a = planet({ id: "A", x: 0, y: 0 });
    const b = planet({ id: "B", x: 10, y: 0 });
    const ab = computeVoidLatency(a, b, geometry, metadata);
    const ba = computeVoidLatency(b, a, geometry, metadata);
    expect(ab.total_ms).toBeCloseTo(ba.total_ms, 9);
  });
});

describe("computeInternalLatency (Tp)", () => {
  it("charges one tower and zero fiber when entry === exit", () => {
    const result = computeInternalLatency(
      planet({ radius_km: 1000, active_towers: 4 }),
      2,
      2,
      geometry,
      metadata,
    );
    expect(result.segments).toBe(0);
    expect(result.towers_hit).toBe(1);
    expect(result.arc_length_km).toBe(0);
    expect(result.fiber_ms).toBe(0);
    expect(result.tower_ms).toBe(7);
    expect(result.total_ms).toBe(7);
  });

  it("matches hand-computed fiber + tower charge across 4 segments", () => {
    const result = computeInternalLatency(
      planet({ radius_km: 1000, active_towers: 8 }),
      0,
      4,
      geometry,
      metadata,
    );
    // s = min(4, 8-4) = 4; m = 5
    expect(result.segments).toBe(4);
    expect(result.towers_hit).toBe(5);
    // arc = 2*pi*1000*4/8 = 1000*pi
    expect(result.arc_length_km).toBeCloseTo(1000 * Math.PI, 6);
    // fiber = arc / (0.67*300000) * 1000
    expect(result.fiber_ms).toBeCloseTo(15.6298142, 5);
    expect(result.tower_ms).toBe(35);
    expect(result.total_ms).toBeCloseTo(50.6298142, 5);
  });

  it("uses the shortest direction around the ring", () => {
    const longWay = computeInternalLatency(
      planet({ active_towers: 8 }),
      0,
      7,
      geometry,
      metadata,
    );
    // 0 -> 7 is 1 segment the short way, not 7
    expect(longWay.segments).toBe(1);
    expect(longWay.towers_hit).toBe(2);
  });

  it("throws on an out-of-range tower index", () => {
    expect(() =>
      computeInternalLatency(planet({ active_towers: 4 }), 0, 4, geometry, metadata),
    ).toThrow(RangeError);
    expect(() =>
      computeInternalLatency(planet({ active_towers: 4 }), -1, 0, geometry, metadata),
    ).toThrow(RangeError);
  });
});

describe("combineRouteLatency", () => {
  it("sums each component and the total per Σ Tp + Σ Tv", () => {
    const internal: InternalLatency[] = [
      {
        segments: 0,
        towers_hit: 1,
        arc_length_km: 0,
        fiber_ms: 0,
        tower_ms: 7,
        total_ms: 7,
      },
      {
        segments: 2,
        towers_hit: 3,
        arc_length_km: 100,
        fiber_ms: 5,
        tower_ms: 21,
        total_ms: 26,
      },
    ];
    const voids: VoidLatency[] = [
      {
        void_distance_km: 1000,
        atmosphere_ms: 0.5,
        void_ms: 100,
        total_ms: 100.5,
      },
    ];

    const breakdown = combineRouteLatency(internal, voids);

    expect(breakdown.fiber_ms).toBe(5);
    expect(breakdown.tower_ms).toBe(28);
    expect(breakdown.atmosphere_ms).toBe(0.5);
    expect(breakdown.void_ms).toBe(100);
    expect(breakdown.total_ms).toBeCloseTo(133.5, 9);
  });

  it("returns all zeros for an empty route", () => {
    const breakdown = combineRouteLatency([], []);
    expect(breakdown.total_ms).toBe(0);
  });
});
