import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  METADATA_DEFAULTS,
  MIN_ACTIVE_TOWERS,
  parseUniverseConfig,
  RelicConfigError,
} from "./config";
import { universeConfigPath } from "./server/universe";

/** Minimal valid metadata used as a base for targeted mutations. */
function validMetadata() {
  return {
    system_name: "Test System",
    speed_of_light_kms: 300000,
    max_void_hop_distance_km: 50000000,
    coordinate_scale_unit_km: 100000,
    tower_processing_delay_ms: 7,
    fiber_speed_fraction: 0.67,
  };
}

/** A single valid node used as a base for targeted mutations. */
function validNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "Aegis",
    codex: 8,
    x: 0,
    y: 0,
    radius_km: 6371,
    active_towers: 8,
    atmosphere_thickness_km: 120,
    refraction_index: 1.0003,
    ...overrides,
  };
}

function validConfig() {
  return {
    universe_metadata: validMetadata(),
    nodes: [validNode(), validNode({ id: "Boreas", codex: 5 })],
  };
}

describe("parseUniverseConfig", () => {
  it("parses the real universe-config.json from the repo root", () => {
    const raw = JSON.parse(readFileSync(universeConfigPath(), "utf8"));

    const universe = parseUniverseConfig(raw);

    expect(universe.nodes).toHaveLength(6);
    expect(universe.metadata.system_name).toBe("Zeta-26");
    expect(universe.metadata.coordinate_scale_unit_km).toBe(100000);
    expect(universe.nodesById.get("Caelum")?.codex).toBe(14);
  });

  it("builds an id -> node lookup map", () => {
    const universe = parseUniverseConfig(validConfig());
    expect(universe.nodesById.size).toBe(2);
    expect(universe.nodesById.get("Boreas")?.codex).toBe(5);
  });

  it("applies documented defaults for omitted optional metadata", () => {
    const config = validConfig();
    const meta = config.universe_metadata as Record<string, unknown>;
    delete meta.speed_of_light_kms;
    delete meta.max_void_hop_distance_km;
    delete meta.tower_processing_delay_ms;
    delete meta.fiber_speed_fraction;

    const universe = parseUniverseConfig(config);

    expect(universe.metadata.speed_of_light_kms).toBe(
      METADATA_DEFAULTS.speed_of_light_kms,
    );
    expect(universe.metadata.max_void_hop_distance_km).toBe(
      METADATA_DEFAULTS.max_void_hop_distance_km,
    );
    expect(universe.metadata.tower_processing_delay_ms).toBe(
      METADATA_DEFAULTS.tower_processing_delay_ms,
    );
    expect(universe.metadata.fiber_speed_fraction).toBe(
      METADATA_DEFAULTS.fiber_speed_fraction,
    );
  });

  it("requires coordinate_scale_unit_km (no default)", () => {
    const config = validConfig();
    delete (config.universe_metadata as Record<string, unknown>)
      .coordinate_scale_unit_km;

    expect(() => parseUniverseConfig(config)).toThrow(RelicConfigError);
  });

  it("rejects a non-object root", () => {
    expect(() => parseUniverseConfig(null)).toThrow(RelicConfigError);
    expect(() => parseUniverseConfig("nope")).toThrow(RelicConfigError);
  });

  it("rejects an empty nodes array", () => {
    const config = validConfig();
    config.nodes = [];
    expect(() => parseUniverseConfig(config)).toThrow(/non-empty array/);
  });

  it("rejects duplicate node ids", () => {
    const config = validConfig();
    config.nodes = [validNode(), validNode()];
    expect(() => parseUniverseConfig(config)).toThrow(/duplicate node id/);
  });

  it(`rejects active_towers below ${MIN_ACTIVE_TOWERS}`, () => {
    const config = {
      universe_metadata: validMetadata(),
      nodes: [validNode({ active_towers: 3 })],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/active_towers/);
  });

  it("rejects a codex below base 2", () => {
    const config = {
      universe_metadata: validMetadata(),
      nodes: [validNode({ codex: 1 })],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/codex/);
  });

  it("rejects a non-integer codex", () => {
    const config = {
      universe_metadata: validMetadata(),
      nodes: [validNode({ codex: 8.5 })],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/codex/);
  });

  it("rejects a missing required numeric field", () => {
    const node = validNode();
    delete (node as Record<string, unknown>).radius_km;
    const config = { universe_metadata: validMetadata(), nodes: [node] };
    expect(() => parseUniverseConfig(config)).toThrow(/radius_km/);
  });

  it("rejects a non-positive refraction index", () => {
    const config = {
      universe_metadata: validMetadata(),
      nodes: [validNode({ refraction_index: 0 })],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/refraction_index/);
  });

  it("rejects a non-positive coordinate scale", () => {
    const config = validConfig();
    (config.universe_metadata as Record<string, unknown>).coordinate_scale_unit_km = -1;
    expect(() => parseUniverseConfig(config)).toThrow(/coordinate_scale_unit_km/);
  });

  it("allows zero atmosphere thickness", () => {
    const config = {
      universe_metadata: validMetadata(),
      nodes: [validNode({ atmosphere_thickness_km: 0 })],
    };
    expect(() => parseUniverseConfig(config)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — interplanetary_links parsing
// ---------------------------------------------------------------------------

describe("parseUniverseConfig — interplanetary_links", () => {
  it("parses all 12 links from the real Phase 2 universe-config.json", () => {
    const raw = JSON.parse(readFileSync(universeConfigPath(), "utf8"));
    const universe = parseUniverseConfig(raw);

    expect(universe.interplanetaryLinks).toHaveLength(12);
    expect(universe.linksById.size).toBe(12);
  });

  it("builds a linksById map with alphabetical link_id keys", () => {
    const raw = JSON.parse(readFileSync(universeConfigPath(), "utf8"));
    const universe = parseUniverseConfig(raw);

    // Spot-check a known link from the config
    const link = universe.linksById.get("Aegis-Boreas");
    expect(link).toBeDefined();
    expect(link?.planet_a).toBe("Aegis");
    expect(link?.planet_b).toBe("Boreas");
    expect(link?.capacity_units).toBe(208);
  });

  it("is backward-compatible: missing interplanetary_links → empty arrays", () => {
    const universe = parseUniverseConfig(validConfig());
    expect(universe.interplanetaryLinks).toHaveLength(0);
    expect(universe.linksById.size).toBe(0);
  });

  it("rejects a non-array interplanetary_links value", () => {
    const config = {
      ...validConfig(),
      interplanetary_links: "not-an-array",
    };
    expect(() => parseUniverseConfig(config)).toThrow(/must be an array/);
  });

  it("rejects a link with an unknown planet", () => {
    const config = {
      ...validConfig(),
      interplanetary_links: [
        {
          link_id: "Aegis-Unknown",
          planet_a: "Aegis",
          planet_b: "Unknown",
          capacity_units: 100,
        },
      ],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/unknown node/);
  });

  it("rejects a link where planet_a === planet_b", () => {
    const config = {
      ...validConfig(),
      interplanetary_links: [
        {
          link_id: "Aegis-Aegis",
          planet_a: "Aegis",
          planet_b: "Aegis",
          capacity_units: 100,
        },
      ],
    };
    expect(() => parseUniverseConfig(config)).toThrow();
  });

  it("rejects a link_id that is not in alphabetical order", () => {
    const config = {
      ...validConfig(),
      interplanetary_links: [
        {
          link_id: "Boreas-Aegis",
          planet_a: "Aegis",
          planet_b: "Boreas",
          capacity_units: 100,
        },
      ],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/alphabetical/);
  });

  it("rejects a link with non-positive capacity_units", () => {
    const config = {
      ...validConfig(),
      interplanetary_links: [
        {
          link_id: "Aegis-Boreas",
          planet_a: "Aegis",
          planet_b: "Boreas",
          capacity_units: 0,
        },
      ],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/capacity_units/);
  });

  it("rejects duplicate link_id entries", () => {
    const dup = {
      link_id: "Aegis-Boreas",
      planet_a: "Aegis",
      planet_b: "Boreas",
      capacity_units: 100,
    };
    const config = {
      ...validConfig(),
      interplanetary_links: [dup, dup],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/duplicate/);
  });

  it("rejects a link whose void distance exceeds Lmax", () => {
    const config = {
      universe_metadata: {
        ...validMetadata(),
        max_void_hop_distance_km: 1,
      },
      nodes: [
        validNode({ id: "Aegis", x: 0, y: 0 }),
        validNode({ id: "Boreas", x: 10_000, y: 0 }),
      ],
      interplanetary_links: [
        {
          link_id: "Aegis-Boreas",
          planet_a: "Aegis",
          planet_b: "Boreas",
          capacity_units: 100,
        },
      ],
    };
    expect(() => parseUniverseConfig(config)).toThrow(/exceeds Lmax/);
  });

  it("accepts links that are within Lmax on the physics graph", () => {
    const raw = JSON.parse(readFileSync(universeConfigPath(), "utf8"));
    expect(() => parseUniverseConfig(raw)).not.toThrow();
    const universe = parseUniverseConfig(raw);
    expect(universe.interplanetaryLinks.length).toBeGreaterThan(0);
  });
});
