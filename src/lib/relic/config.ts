/**
 * Dynamic parser and validator for universe-config.json.
 *
 * No planetary or physical value is hardcoded: constants come from
 * `universe_metadata`, falling back to documented defaults only for the four
 * values the spec marks as defaultable.
 */

import { canonicalLinkId } from "../chimera/link-id";
import type {
  InterplanetaryLink,
  PlanetNode,
  Universe,
  UniverseMetadata,
} from "./types";
import { createStubGeometryProvider } from "./stubs/geometry.stub";

/** Documented defaults for the optional metadata constants. */
export const METADATA_DEFAULTS = {
  speed_of_light_kms: 300_000,
  max_void_hop_distance_km: 50_000_000,
  tower_processing_delay_ms: 7,
  fiber_speed_fraction: 0.67,
} as const;

/** Minimum towers per planet, per the challenge ("more than or equal to 4"). */
export const MIN_ACTIVE_TOWERS = 4;

/** Smallest valid numerical base for a codex. */
export const MIN_CODEX_BASE = 2;

/** Error thrown when the configuration is malformed or invalid. */
export class RelicConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelicConfigError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a finite number field, throwing a descriptive error otherwise. */
function requireFiniteNumber(
  source: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RelicConfigError(
      `${context}: "${key}" must be a finite number, received ${describe(value)}.`,
    );
  }
  return value;
}

/** Read a number field, applying a default when the key is absent. */
function optionalFiniteNumber(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
  context: string,
): number {
  if (source[key] === undefined || source[key] === null) {
    return fallback;
  }
  return requireFiniteNumber(source, key, context);
}

function requireNonEmptyString(
  source: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RelicConfigError(
      `${context}: "${key}" must be a non-empty string, received ${describe(value)}.`,
    );
  }
  return value;
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

function parseMetadata(raw: unknown): UniverseMetadata {
  if (!isObject(raw)) {
    throw new RelicConfigError('Config: "universe_metadata" must be an object.');
  }
  const context = "universe_metadata";
  const coordinate_scale_unit_km = requireFiniteNumber(
    raw,
    "coordinate_scale_unit_km",
    context,
  );
  if (coordinate_scale_unit_km <= 0) {
    throw new RelicConfigError(
      `${context}: "coordinate_scale_unit_km" must be greater than 0.`,
    );
  }

  return {
    system_name:
      typeof raw.system_name === "string" ? raw.system_name : "Unknown System",
    speed_of_light_kms: positive(
      optionalFiniteNumber(
        raw,
        "speed_of_light_kms",
        METADATA_DEFAULTS.speed_of_light_kms,
        context,
      ),
      "speed_of_light_kms",
      context,
    ),
    max_void_hop_distance_km: positive(
      optionalFiniteNumber(
        raw,
        "max_void_hop_distance_km",
        METADATA_DEFAULTS.max_void_hop_distance_km,
        context,
      ),
      "max_void_hop_distance_km",
      context,
    ),
    coordinate_scale_unit_km,
    tower_processing_delay_ms: nonNegative(
      optionalFiniteNumber(
        raw,
        "tower_processing_delay_ms",
        METADATA_DEFAULTS.tower_processing_delay_ms,
        context,
      ),
      "tower_processing_delay_ms",
      context,
    ),
    fiber_speed_fraction: positive(
      optionalFiniteNumber(
        raw,
        "fiber_speed_fraction",
        METADATA_DEFAULTS.fiber_speed_fraction,
        context,
      ),
      "fiber_speed_fraction",
      context,
    ),
  };
}

function positive(value: number, key: string, context: string): number {
  if (value <= 0) {
    throw new RelicConfigError(
      `${context}: "${key}" must be greater than 0, received ${value}.`,
    );
  }
  return value;
}

function nonNegative(value: number, key: string, context: string): number {
  if (value < 0) {
    throw new RelicConfigError(
      `${context}: "${key}" must be 0 or greater, received ${value}.`,
    );
  }
  return value;
}

function parseNode(raw: unknown, index: number): PlanetNode {
  if (!isObject(raw)) {
    throw new RelicConfigError(`nodes[${index}]: must be an object.`);
  }
  const context = `nodes[${index}]`;
  const id = requireNonEmptyString(raw, "id", context);
  const nodeContext = `node "${id}"`;

  const codex = requireFiniteNumber(raw, "codex", nodeContext);
  if (!Number.isInteger(codex) || codex < MIN_CODEX_BASE) {
    throw new RelicConfigError(
      `${nodeContext}: "codex" must be an integer >= ${MIN_CODEX_BASE}, received ${codex}.`,
    );
  }

  const active_towers = requireFiniteNumber(raw, "active_towers", nodeContext);
  if (!Number.isInteger(active_towers) || active_towers < MIN_ACTIVE_TOWERS) {
    throw new RelicConfigError(
      `${nodeContext}: "active_towers" must be an integer >= ${MIN_ACTIVE_TOWERS}, received ${active_towers}.`,
    );
  }

  return {
    id,
    codex,
    x: requireFiniteNumber(raw, "x", nodeContext),
    y: requireFiniteNumber(raw, "y", nodeContext),
    radius_km: positive(
      requireFiniteNumber(raw, "radius_km", nodeContext),
      "radius_km",
      nodeContext,
    ),
    active_towers,
    atmosphere_thickness_km: nonNegative(
      requireFiniteNumber(raw, "atmosphere_thickness_km", nodeContext),
      "atmosphere_thickness_km",
      nodeContext,
    ),
    refraction_index: positive(
      requireFiniteNumber(raw, "refraction_index", nodeContext),
      "refraction_index",
      nodeContext,
    ),
  };
}

/**
 * Parse a single interplanetary link entry, validating its structure and
 * cross-checking the link_id against the canonical alphabetical convention.
 */
function parseInterplanetaryLink(
  raw: unknown,
  index: number,
  nodesById: Map<string, PlanetNode>,
): InterplanetaryLink {
  if (!isObject(raw)) {
    throw new RelicConfigError(`interplanetary_links[${index}]: must be an object.`);
  }
  const context = `interplanetary_links[${index}]`;

  const planet_a = requireNonEmptyString(raw, "planet_a", context);
  const planet_b = requireNonEmptyString(raw, "planet_b", context);

  if (!nodesById.has(planet_a)) {
    throw new RelicConfigError(
      `${context}: "planet_a" references unknown node "${planet_a}".`,
    );
  }
  if (!nodesById.has(planet_b)) {
    throw new RelicConfigError(
      `${context}: "planet_b" references unknown node "${planet_b}".`,
    );
  }
  if (planet_a === planet_b) {
    throw new RelicConfigError(
      `${context}: "planet_a" and "planet_b" must be different planets.`,
    );
  }

  const expectedLinkId = canonicalLinkId(planet_a, planet_b);
  const link_id = requireNonEmptyString(raw, "link_id", context);
  if (link_id !== expectedLinkId) {
    throw new RelicConfigError(
      `${context}: "link_id" must be "${expectedLinkId}" (alphabetical), received "${link_id}".`,
    );
  }

  const capacity_units = requireFiniteNumber(raw, "capacity_units", context);
  if (capacity_units <= 0) {
    throw new RelicConfigError(
      `${context}: "capacity_units" must be greater than 0, received ${capacity_units}.`,
    );
  }

  return { link_id, planet_a, planet_b, capacity_units };
}

/**
 * Ensure every configured interplanetary link is a valid physics void hop
 * (void distance L <= Lmax). Chimera only operates on links the Phase 1
 * graph would allow as a direct laser hop.
 */
function validateInterplanetaryLinksAgainstPhysics(
  metadata: UniverseMetadata,
  nodesById: Map<string, PlanetNode>,
  links: InterplanetaryLink[],
): void {
  if (links.length === 0) {
    return;
  }

  const geometry = createStubGeometryProvider(metadata);
  const lmax = metadata.max_void_hop_distance_km;

  for (const link of links) {
    const nodeA = nodesById.get(link.planet_a);
    const nodeB = nodesById.get(link.planet_b);
    if (!nodeA || !nodeB) {
      continue;
    }

    const voidKm = geometry.voidDistanceKm(nodeA, nodeB);
    if (voidKm > lmax) {
      throw new RelicConfigError(
        `interplanetary_links: link "${link.link_id}" void distance ${voidKm.toFixed(3)} km exceeds Lmax (${lmax} km); not a valid physics hop.`,
      );
    }
  }
}

/**
 * Parse and validate a raw universe configuration object.
 * @throws {RelicConfigError} when the structure or any value is invalid.
 */
export function parseUniverseConfig(raw: unknown): Universe {
  if (!isObject(raw)) {
    throw new RelicConfigError("Config: root must be a JSON object.");
  }

  const metadata = parseMetadata(raw.universe_metadata);

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    throw new RelicConfigError('Config: "nodes" must be a non-empty array.');
  }

  const nodes = raw.nodes.map((node, index) => parseNode(node, index));

  const nodesById = new Map<string, PlanetNode>();
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new RelicConfigError(`Config: duplicate node id "${node.id}".`);
    }
    nodesById.set(node.id, node);
  }

  // Phase 2: parse optional interplanetary_links (backward-compatible)
  const interplanetaryLinks: InterplanetaryLink[] = [];
  const linksById = new Map<string, InterplanetaryLink>();

  if (Array.isArray(raw.interplanetary_links)) {
    for (let i = 0; i < raw.interplanetary_links.length; i++) {
      const link = parseInterplanetaryLink(raw.interplanetary_links[i], i, nodesById);
      if (linksById.has(link.link_id)) {
        throw new RelicConfigError(
          `Config: duplicate interplanetary link "${link.link_id}".`,
        );
      }
      interplanetaryLinks.push(link);
      linksById.set(link.link_id, link);
    }
  } else if (
    raw.interplanetary_links !== undefined &&
    raw.interplanetary_links !== null
  ) {
    throw new RelicConfigError(
      'Config: "interplanetary_links" must be an array when present.',
    );
  }

  validateInterplanetaryLinksAgainstPhysics(metadata, nodesById, interplanetaryLinks);

  return { metadata, nodes, nodesById, interplanetaryLinks, linksById };
}
