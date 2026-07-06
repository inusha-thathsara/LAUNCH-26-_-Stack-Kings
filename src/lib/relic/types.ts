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
  /**
   * Interplanetary links from the Phase 2 extended config.
   * Empty array when the config file does not include `interplanetary_links`.
   */
  interplanetaryLinks: InterplanetaryLink[];
  /** Fast link_id -> link lookup. */
  linksById: Map<string, InterplanetaryLink>;
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
  /** Payload encoded in this planet's (local) codex dialect. */
  payload_dialect: DialectView;
  /**
   * Codex base of the NEXT hop; the payload is re-encoded into this dialect
   * before being beamed across the void. Omitted at the destination.
   */
  next_hop_codex?: number;
  /**
   * The payload encoded into the next hop's dialect (what actually crosses the
   * void). Omitted at the destination.
   */
  next_hop_dialect?: DialectView;
  /**
   * Flat binary serialization of {@link next_hop_dialect} that travels the void
   * laser link. Omitted at the destination.
   */
  binary_stream?: string;
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

// ---------------------------------------------------------------------------
// Phase 2 — Chimera Co-Pilot types
// ---------------------------------------------------------------------------

/**
 * A single interplanetary link entry from `universe-config.json`.
 * `link_id` must equal `canonicalLinkId(planet_a, planet_b)` (alphabetical).
 */
export interface InterplanetaryLink {
  /** Alphabetical combination of the two planet IDs, e.g. "Aegis-Boreas". */
  link_id: string;
  planet_a: string;
  planet_b: string;
  /** Maximum traffic capacity in abstract traffic units. */
  capacity_units: number;
}

/**
 * Live state of one interplanetary link as returned by `GET /state` on the
 * Chimera API. The null `self_reported_latency_ms` case must be handled
 * explicitly — it signals saturation and means the link is unavailable.
 */
export interface ChimeraLinkState {
  link_id: string;
  planet_a: string;
  planet_b: string;
  capacity_units: number;
  /** Actual traffic load on the link (same units as capacity_units). */
  current_load: number;
  /** Normalized load: current_load / capacity_units (0–1). */
  load_ratio: number;
  /**
   * Latency claimed by the link itself. May be null when status is "saturated".
   * Do NOT treat null as latency 0 — treat the link as unavailable.
   */
  self_reported_latency_ms: number | null;
  /** This link's fraction of total network traffic (0–1). */
  traffic_share: number;
  status: "ok" | "saturated";
}

/**
 * Scores produced by the Co-Pilot agent for a single interplanetary link
 * as part of the sequential evaluation loop.
 */
export interface LinkEvaluation {
  /** Alphabetical link identifier, e.g. "Aegis-Boreas". */
  link_id: string;
  /** Chimera-induced extra latency predicted for this link, in ms. */
  predicted_congestion_penalty_ms: number;
  /** Reliability of the link's self-reported telemetry (0–1; higher = more trustworthy). */
  trust_score: number;
  /** Probability of Chimera targeting this link (0–1; higher = more risk). */
  targeting_risk_score: number;
  /** Composite routing cost used by the True Cost router, in ms-equivalent units. */
  combined_cost: number;
}

/**
 * Mandatory Council output schema for every Phase 2 routing decision.
 * All fields are required; omissions cause disqualification.
 */
export interface Phase2RoutingReport {
  origin_id: string;
  destination_id: string;
  /** Ordered list of planet IDs on the final chosen path. */
  chosen_path: string[];
  /** One entry per interplanetary link on the final chosen path. */
  link_evaluations: LinkEvaluation[];
  /** Estimated total end-to-end latency (physics + congestion penalties), in ms. */
  final_latency_estimate_ms: number;
  /** Human-readable narrative explaining the routing decision and any overrides. */
  explanation: string;
}

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
