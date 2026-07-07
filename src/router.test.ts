/**
 * Integration contracts for the two teammate-owned modules.
 *
 * Your engine depends only on these interfaces, never on concrete teammate code.
 * Functional stubs live in `./stubs/` so the engine runs end-to-end today; swap
 * them for the real implementations at merge time with no changes to your code.
 */

import type { PlanetNode } from "./types";

/* -------------------------------------------------------------------------- */
/* Mapping module (teammate): geometry & topology                             */
/* -------------------------------------------------------------------------- */

/** Absolute position of a tower on a planet's equatorial ring, in km. */
export interface TowerPosition {
  /** Tower index (0 at the top / positive y-axis, increasing clockwise). */
  index: number;
  /** Absolute world X in kilometers. */
  x_km: number;
  /** Absolute world Y in kilometers. */
  y_km: number;
  /** Angular position in degrees, clockwise from the top. */
  angle_deg: number;
}

/**
 * The closest tower pair across the void between two planets (line of sight).
 * Used to choose sending/receiving towers and for internal fiber routing — it
 * does NOT change the center-based void distance L used in the Tv formula.
 */
export interface TowerPair {
  /** Sending tower index on the origin planet. */
  origin_tower: number;
  /** Receiving tower index on the destination planet. */
  destination_tower: number;
  /** Straight-line distance between the two towers in km (line of sight). */
  separation_km: number;
}

/**
 * Geometry provider owned by the mapping teammate.
 *
 * Reference formulas this must satisfy:
 *  - S (center distance) = coordinate_scale_unit_km * sqrt((x2-x1)^2 + (y2-y1)^2)
 *  - L (void distance)   = S - (R1 + h1) - (R2 + h2)
 */
export interface GeometryProvider {
  /** Towers placed at equal angular intervals on the planet's ring. */
  towerPositions(planet: PlanetNode): TowerPosition[];
  /** Scaled center-to-center distance between two planets, in km (S). */
  centerDistanceKm(a: PlanetNode, b: PlanetNode): number;
  /** Center-based void distance between two planets, in km (L). */
  voidDistanceKm(a: PlanetNode, b: PlanetNode): number;
  /** Tower pair minimizing straight-line void distance (line of sight). */
  closestTowerPair(a: PlanetNode, b: PlanetNode): TowerPair;
  /**
   * Number of ring segments between an entry and exit tower on a planet (s).
   * Returns 0 when entry tower === exit tower.
   */
  segmentsBetween(
    planet: PlanetNode,
    entryTower: number,
    exitTower: number,
  ): number;
}

/* -------------------------------------------------------------------------- */
/* Encoding/Decoding module (teammate): data translation                      */
/* -------------------------------------------------------------------------- */

/** Payload encoded in a specific numerical base (codex). */
export interface EncodedPayload {
  /** Numerical base of the digits. */
  base: number;
  /** Per-character digit strings in the given base (e.g. ["242", "401"]). */
  digits: string[];
}

/**
 * Codec owned by the encoding/decoding teammate.
 *
 * Transmission flow it must support:
 *   Raw payload -> Next-hop codex -> binary stream -> void -> destination codex
 *   -> local decoding. Internally, planets route in ASCII between towers.
 */
export interface Codec {
  /** Raw string to ASCII byte array. */
  toAscii(payload: string): number[];
  /** ASCII byte array back to a raw string. */
  fromAscii(bytes: number[]): string;
  /** ASCII bytes to codex-base digits. */
  encodeToCodex(asciiBytes: number[], base: number): EncodedPayload;
  /** Codex-base digits back to ASCII bytes. */
  decodeFromCodex(encoded: EncodedPayload): number[];
  /** Serialize codex digits into a flat binary stream for the void. */
  serializeToBinary(encoded: EncodedPayload): string;
  /** Read a flat binary stream back into codex digits. */
  deserializeFromBinary(stream: string, base: number): EncodedPayload;
}
