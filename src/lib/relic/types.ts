/**
 * Core domain types for the Relic Ring Protocol.
 *
 * These mirror the universe-config.json schema and the mandatory packet schema
 * defined in the challenge. All physical constants live in {@link UniverseMetadata}
 * and must be read from config — never hardcoded.
 */

/** Universe-level physical constants, read from `universe_metadata`. */
export interface UniverseMetadata {
  /** Human-readable system name (e.g. "Zeta-26"). */
  system_name: string;
  /** Speed of light in km/s (C). Default 300,000 when omitted. */
  speed_of_light_kms: number;
  /** Lmax: a single void hop cannot exceed this distance in km. */
  max_void_hop_distance_km: number;
  /** Multiplier converting abstract grid units to kilometers. Required. */
  coordinate_scale_unit_km: number;
  /** Fixed processing penalty per tower hit, in ms (Δt). Default 7. */
  tower_processing_delay_ms: number;
  /** Fiber propagation speed as a fraction of C (f). Default 0.67. */
  fiber_speed_fraction: number;
}

/** A single planet (node) in the universe grid. */
export interface PlanetNode {
  /** Unique string identifier for the planet. */
  id: string;
  /** Numerical base used by this planet for receiving data. */
  codex: number;
  /** X coordinate in abstract grid units (scale before use). */
  x: number;
  /** Y coordinate in abstract grid units (scale before use). */
  y: number;
  /** Physical radius in kilometers (already in km, never scaled). */
  radius_km: number;
  /** Total routing towers on the equatorial ring (>= 4). */
  active_towers: number;
  /** Atmospheric shell thickness in kilometers (h). */
  atmosphere_thickness_km: number;
  /** Local atmospheric refraction index (n). */
  refraction_index: number;
}

/** Fully parsed and validated universe, ready for the engine. */
export interface Universe {
  metadata: UniverseMetadata;
  nodes: PlanetNode[];
  /** Fast id -> node lookup. */
  nodesById: Map<string, PlanetNode>;
}

/**
 * Per-component latency breakdown for a single planet/hop, in milliseconds.
 * Populated by the latency engine (Phase 2); kept here so the schema is shared.
 *
 *  - fiber: internal equatorial fiber arc transit between towers
 *  - tower: processing delay charged per distinct tower hit (m * Δt)
 *  - atmosphere: refraction component of void travel ((h1*n1 + h2*n2) / C)
 *  - void: vacuum laser component of void travel (L / C)
 */
export interface LatencyBreakdown {
  fiber_ms: number;
  tower_ms: number;
  atmosphere_ms: number;
  void_ms: number;
  total_ms: number;
}

/**
 * Representation of the payload in a single planet's dialect.
 * `digits` holds the per-character codex digits (e.g. ["242", "401", ...]).
 */
export interface DialectView {
  base: number;
  digits: string[];
}

/**
 * A single entry in a packet's hop_log. Appended to by each relay node during
 * transit to mathematically prove the route taken (per-tower info).
 */
export interface HopLogEntry {
  /** Zero-based order of this hop in the route. */
  sequence: number;
  /** Planet visited at this step. */
  planet_id: string;
  /** Numerical base of this planet. */
  codex: number;
  /** Tower index where the packet entered the planet. */
  entry_tower: number;
  /** Tower index from which the packet exits the planet. */
  exit_tower: number;
  /** Number of distinct towers hit on this planet (m). */
  towers_hit: number;
  /** Number of ring segments traversed between entry and exit tower (s). */
  segments: number;
  /** Payload as ASCII bytes while routed internally between towers. */
  payload_ascii: number[];
  /** Payload encoded in this planet's codex dialect. */
  payload_dialect: DialectView;
  /** Internal crust transit time for this planet (Tp), in ms. */
  internal_latency_ms: number;
  /** Void travel time for the hop leaving this planet (Tv); omitted at destination. */
  void_latency_ms?: number;
  /** Next planet id in the route; omitted at destination. */
  next_hop_id?: string;
  /** Running total latency up to and including this entry, in ms. */
  cumulative_latency_ms: number;
}

/** Lifecycle status of a packet. */
export type PacketStatus = "pending" | "delivered" | "undeliverable";

/**
 * Mandatory packet schema. Additional fields may be added as needed; the
 * required fields are origin_id, destination_id, current_id, payload, hop_log.
 */
export interface Packet {
  origin_id: string;
  destination_id: string;
  current_id: string;
  /** Raw message content; its per-dialect views are recorded in hop_log. */
  payload: string;
  /** Ordered proof-of-route log appended by each relay node. */
  hop_log: HopLogEntry[];
  status: PacketStatus;
  /** Reason populated when status is "undeliverable". */
  undeliverable_reason?: string;
}
