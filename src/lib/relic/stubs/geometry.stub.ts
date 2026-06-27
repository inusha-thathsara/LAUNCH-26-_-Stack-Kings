/**
 * STUB — Mapping teammate module.
 *
 * A functional placeholder geometry provider so the engine runs and is testable
 * end-to-end before the mapping teammate's implementation is merged. Replace the
 * export wiring (not your engine code) when their real module lands.
 *
 * Geometry conventions used here:
 *  - Grid coordinates are scaled by coordinate_scale_unit_km to get kilometers.
 *  - Tower 0 sits at the top (positive y-axis); indices increase clockwise.
 *  - Void distance L is center-based (line-of-sight only picks towers).
 */

import type {
  GeometryProvider,
  TowerPair,
  TowerPosition,
} from "../contracts";
import type { PlanetNode, UniverseMetadata } from "../types";

export class StubGeometryProvider implements GeometryProvider {
  constructor(private readonly metadata: UniverseMetadata) {}

  private centerXKm(planet: PlanetNode): number {
    return planet.x * this.metadata.coordinate_scale_unit_km;
  }

  private centerYKm(planet: PlanetNode): number {
    return planet.y * this.metadata.coordinate_scale_unit_km;
  }

  towerPositions(planet: PlanetNode): TowerPosition[] {
    const cx = this.centerXKm(planet);
    const cy = this.centerYKm(planet);
    const step = 360 / planet.active_towers;
    const positions: TowerPosition[] = [];
    for (let index = 0; index < planet.active_towers; index += 1) {
      const angleDeg = index * step;
      const angleRad = (angleDeg * Math.PI) / 180;
      // Clockwise from the top: x grows with sin, y with cos.
      positions.push({
        index,
        x_km: cx + planet.radius_km * Math.sin(angleRad),
        y_km: cy + planet.radius_km * Math.cos(angleRad),
        angle_deg: angleDeg,
      });
    }
    return positions;
  }

  centerDistanceKm(a: PlanetNode, b: PlanetNode): number {
    const dx = this.centerXKm(b) - this.centerXKm(a);
    const dy = this.centerYKm(b) - this.centerYKm(a);
    return Math.hypot(dx, dy);
  }

  voidDistanceKm(a: PlanetNode, b: PlanetNode): number {
    const surfaceA = a.radius_km + a.atmosphere_thickness_km;
    const surfaceB = b.radius_km + b.atmosphere_thickness_km;
    return this.centerDistanceKm(a, b) - surfaceA - surfaceB;
  }

  closestTowerPair(a: PlanetNode, b: PlanetNode): TowerPair {
    const towersA = this.towerPositions(a);
    const towersB = this.towerPositions(b);

    let best: TowerPair = {
      origin_tower: 0,
      destination_tower: 0,
      separation_km: Number.POSITIVE_INFINITY,
    };

    for (const ta of towersA) {
      for (const tb of towersB) {
        const separation = Math.hypot(tb.x_km - ta.x_km, tb.y_km - ta.y_km);
        if (separation < best.separation_km) {
          best = {
            origin_tower: ta.index,
            destination_tower: tb.index,
            separation_km: separation,
          };
        }
      }
    }
    return best;
  }

  segmentsBetween(
    planet: PlanetNode,
    entryTower: number,
    exitTower: number,
  ): number {
    const n = planet.active_towers;
    const diff = Math.abs(entryTower - exitTower) % n;
    return Math.min(diff, n - diff);
  }
}

/** Build a stub geometry provider for the given universe metadata. */
export function createStubGeometryProvider(
  metadata: UniverseMetadata,
): GeometryProvider {
  return new StubGeometryProvider(metadata);
}
