import { describe, expect, it } from "vitest";

import type { PlanetNode, UniverseMetadata } from "../types";
import { createStubCodec } from "./codec.stub";
import { createStubGeometryProvider } from "./geometry.stub";

const metadata: UniverseMetadata = {
  system_name: "Zeta-26",
  speed_of_light_kms: 300000,
  max_void_hop_distance_km: 50000000,
  coordinate_scale_unit_km: 100000,
  tower_processing_delay_ms: 7,
  fiber_speed_fraction: 0.67,
};

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

describe("StubCodec", () => {
  const codec = createStubCodec();

  it("round-trips ASCII conversion", () => {
    const bytes = codec.toAscii("Hello world");
    expect(bytes).toEqual([72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]);
    expect(codec.fromAscii(bytes)).toBe("Hello world");
  });

  it("matches the challenge base-5 encoding example", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 5);
    expect(encoded.digits).toEqual([
      "242",
      "401",
      "413",
      "413",
      "421",
      "112",
      "434",
      "421",
      "424",
      "413",
      "400",
    ]);
  });

  it("matches the challenge base-14 encoding example", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 14);
    expect(encoded.digits).toEqual([
      "52",
      "73",
      "7A",
      "7A",
      "7D",
      "24",
      "87",
      "7D",
      "82",
      "7A",
      "72",
    ]);
  });

  it("round-trips codex encode/decode", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 8);
    expect(codec.decodeFromCodex(encoded)).toEqual(bytes);
  });

  it("round-trips binary serialization", () => {
    const bytes = codec.toAscii("Hi");
    const encoded = codec.encodeToCodex(bytes, 5);
    const stream = codec.serializeToBinary(encoded);
    const restored = codec.deserializeFromBinary(stream, 5);
    expect(restored.digits).toEqual(encoded.digits);
  });
});

describe("StubGeometryProvider", () => {
  const geo = createStubGeometryProvider(metadata);

  it("places tower 0 at the top (positive y)", () => {
    const towers = geo.towerPositions(planet());
    expect(towers).toHaveLength(4);
    expect(towers[0].angle_deg).toBe(0);
    expect(towers[0].y_km).toBeCloseTo(1000, 5);
    expect(towers[0].x_km).toBeCloseTo(0, 5);
  });

  it("computes scaled center distance", () => {
    const a = planet({ id: "A", x: 0, y: 0 });
    const b = planet({ id: "B", x: 3, y: 4 });
    // sqrt(3^2 + 4^2) * 100000 = 5 * 100000
    expect(geo.centerDistanceKm(a, b)).toBeCloseTo(500000, 5);
  });

  it("computes center-based void distance", () => {
    const a = planet({ id: "A", x: 0, y: 0, radius_km: 1000, atmosphere_thickness_km: 50 });
    const b = planet({ id: "B", x: 3, y: 4, radius_km: 2000, atmosphere_thickness_km: 100 });
    // 500000 - (1000+50) - (2000+100)
    expect(geo.voidDistanceKm(a, b)).toBeCloseTo(500000 - 1050 - 2100, 5);
  });

  it("returns 0 segments for the same entry/exit tower", () => {
    expect(geo.segmentsBetween(planet(), 2, 2)).toBe(0);
  });

  it("uses the shortest direction around the ring", () => {
    // 8 towers: from 0 to 6 is 6 forward but 2 backward.
    expect(geo.segmentsBetween(planet({ active_towers: 8 }), 0, 6)).toBe(2);
  });
});
