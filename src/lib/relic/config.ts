/**
 * Dynamic parser and validator for universe-config.json.
 *
 * No planetary or physical value is hardcoded: constants come from
 * `universe_metadata`, falling back to documented defaults only for the four
 * values the spec marks as defaultable.
 */

import type { PlanetNode, Universe, UniverseMetadata } from "./types";

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
    throw new RelicConfigError(
      'Config: "universe_metadata" must be an object.',
    );
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
 * Parse and validate a raw universe configuration object.
 * @throws {RelicConfigError} when the structure or any value is invalid.
 */
export function parseUniverseConfig(raw: unknown): Universe {
  if (!isObject(raw)) {
    throw new RelicConfigError("Config: root must be a JSON object.");
  }

  const metadata = parseMetadata(raw.universe_metadata);

  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    throw new RelicConfigError(
      'Config: "nodes" must be a non-empty array.',
    );
  }

  const nodes = raw.nodes.map((node, index) => parseNode(node, index));

  const nodesById = new Map<string, PlanetNode>();
  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new RelicConfigError(
        `Config: duplicate node id "${node.id}".`,
      );
    }
    nodesById.set(node.id, node);
  }

  return { metadata, nodes, nodesById };
}
