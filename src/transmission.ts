/**
 * Latency engine for the Relic Ring Protocol.
 *
 * Implements the two physical latency primitives from the mathematical
 * reference, reading every constant from {@link UniverseMetadata} and all
 * geometry from a {@link GeometryProvider} (the mapping teammate's module).
 *
 * Void travel time (per void hop between consecutive planets):
 *   Tv = ((h1 * n1) + (h2 * n2) + L) / C
 *
 * Internal crust transit time (per planet visited):
 *   Tp = (2 * pi * r * s) / (N * f * C) + m * Δt
 *   where m = s + 1 (the dedup case entry === exit yields s = 0, so m = 1).
 *
 * All results are expressed in milliseconds to match Δt (tower delay in ms).
 */

import type { GeometryProvider } from "./contracts";
import type { LatencyBreakdown, PlanetNode, UniverseMetadata } from "./types";

const MS_PER_SECOND = 1000;

/** Detailed void-hop latency between two consecutive planets (Tv). */
export interface VoidLatency {
  /** Void distance used in the calculation (L), in km. */
  void_distance_km: number;
  /** Refraction component: (h1*n1 + h2*n2) / C, in ms. */
  atmosphere_ms: number;
  /** Vacuum component: L / C, in ms. */
  void_ms: number;
  /** Total void travel time (Tv), in ms. */
  total_ms: number;
}

/** Detailed internal crust-transit latency for a single planet (Tp). */
export interface InternalLatency {
  /** Ring segments traversed between entry and exit tower (s). */
  segments: number;
  /** Distinct towers hit for the processing charge (m = s + 1). */
  towers_hit: number;
  /** Fiber arc length traveled along the equatorial ring, in km. */
  arc_length_km: number;
  /** Fiber component: arc / (f * C), in ms. */
  fiber_ms: number;
  /** Tower processing component: m * Δt, in ms. */
  tower_ms: number;
  /** Total internal crust transit time (Tp), in ms. */
  total_ms: number;
}

function assertTowerInRange(planet: PlanetNode, tower: number): void {
  if (
    !Number.isInteger(tower) ||
    tower < 0 ||
    tower >= planet.active_towers
  ) {
    throw new RangeError(
      `Tower index ${tower} is out of range for planet "${planet.id}" (0..${planet.active_towers - 1}).`,
    );
  }
}

/**
 * Compute the void travel time (Tv) for a single hop across the vacuum.
 * The void distance L is center-based (per the Void Distance Simplification);
 * tower angular position does not affect this value.
 */
export function computeVoidLatency(
  origin: PlanetNode,
  destination: PlanetNode,
  geometry: GeometryProvider,
  metadata: UniverseMetadata,
): VoidLatency {
  const voidDistanceKm = geometry.voidDistanceKm(origin, destination);
  const c = metadata.speed_of_light_kms;

  const refractedDistanceKm =
    origin.atmosphere_thickness_km * origin.refraction_index +
    destination.atmosphere_thickness_km * destination.refraction_index;

  const atmosphere_ms = (refractedDistanceKm / c) * MS_PER_SECOND;
  const void_ms = (voidDistanceKm / c) * MS_PER_SECOND;

  return {
    void_distance_km: voidDistanceKm,
    atmosphere_ms,
    void_ms,
    total_ms: atmosphere_ms + void_ms,
  };
}

/**
 * Compute the internal crust transit time (Tp) for one planet, given the
 * tower where the packet enters and the tower it exits from. When the entry
 * and exit towers are the same, no fiber transit occurs and a single tower is
 * charged.
 */
export function computeInternalLatency(
  planet: PlanetNode,
  entryTower: number,
  exitTower: number,
  geometry: GeometryProvider,
  metadata: UniverseMetadata,
): InternalLatency {
  assertTowerInRange(planet, entryTower);
  assertTowerInRange(planet, exitTower);

  const segments = geometry.segmentsBetween(planet, entryTower, exitTower);
  const towers_hit = segments + 1;

  const circumferenceKm = 2 * Math.PI * planet.radius_km;
  const arc_length_km = (circumferenceKm * segments) / planet.active_towers;

  const fiberSpeed = metadata.fiber_speed_fraction * metadata.speed_of_light_kms;
  const fiber_ms = (arc_length_km / fiberSpeed) * MS_PER_SECOND;
  const tower_ms = towers_hit * metadata.tower_processing_delay_ms;

  return {
    segments,
    towers_hit,
    arc_length_km,
    fiber_ms,
    tower_ms,
    total_ms: fiber_ms + tower_ms,
  };
}

/**
 * Aggregate per-planet and per-hop latencies into a route-level component
 * breakdown (fiber, towers, atmosphere, void), per the end-to-end composition:
 *   Total = Σ Tp(Pi) + Σ Tv(Pi, Pi+1).
 */
export function combineRouteLatency(
  internal: InternalLatency[],
  voids: VoidLatency[],
): LatencyBreakdown {
  const fiber_ms = internal.reduce((sum, leg) => sum + leg.fiber_ms, 0);
  const tower_ms = internal.reduce((sum, leg) => sum + leg.tower_ms, 0);
  const atmosphere_ms = voids.reduce((sum, hop) => sum + hop.atmosphere_ms, 0);
  const void_ms = voids.reduce((sum, hop) => sum + hop.void_ms, 0);

  return {
    fiber_ms,
    tower_ms,
    atmosphere_ms,
    void_ms,
    total_ms: fiber_ms + tower_ms + atmosphere_ms + void_ms,
  };
}
