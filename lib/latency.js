export function getConstants(config) {
  const meta = config.universe_metadata || {};

  return {
    C: meta.speed_of_light_kms ?? 300000,
    LMAX: meta.max_void_hop_distance_km ?? 50000000,
    S: meta.coordinate_scale_unit_km ?? 100000,
    towerDelayMs: meta.tower_processing_delay_ms ?? 7,
    fiberFraction: meta.fiber_speed_fraction ?? 0.67,
  };
}

export function voidDistanceKm(a, b, constants) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const centerDistance = Math.sqrt(dx * dx + dy * dy) * constants.S;

  const distance =
    centerDistance -
    (a.radius_km + a.atmosphere_thickness_km) -
    (b.radius_km + b.atmosphere_thickness_km);

  return Math.max(0, distance);
}

export function voidTravelTimeSeconds(a, b, constants) {
  const L = voidDistanceKm(a, b, constants);

  const atmospherePart =
    a.atmosphere_thickness_km * a.refraction_index +
    b.atmosphere_thickness_km * b.refraction_index;

  return {
    voidDistanceKm: L,
    atmosphereDistanceKm: atmospherePart,
    voidTimeSeconds: (atmospherePart + L) / constants.C,
  };
}

export function towerIndexTowardPlanet(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  let clockwiseFromTop = Math.PI / 2 - angle;

  while (clockwiseFromTop < 0) clockwiseFromTop += 2 * Math.PI;
  while (clockwiseFromTop >= 2 * Math.PI) clockwiseFromTop -= 2 * Math.PI;

  const segmentAngle = (2 * Math.PI) / from.active_towers;

  return Math.round(clockwiseFromTop / segmentAngle) % from.active_towers;
}

export function ringSegments(entryTower, exitTower, totalTowers) {
  const diff = Math.abs(exitTower - entryTower);
  return Math.min(diff, totalTowers - diff);
}

export function internalPlanetTimeSeconds(planet, entryTower, exitTower, constants) {
  const s = ringSegments(entryTower, exitTower, planet.active_towers);

  const fiberTime =
    (2 * Math.PI * planet.radius_km * s) /
    (planet.active_towers * constants.fiberFraction * constants.C);

  const towerHits = entryTower === exitTower ? 1 : s + 1;
  const towerDelaySeconds = (towerHits * constants.towerDelayMs) / 1000;

  return {
    entryTower,
    exitTower,
    segments: s,
    towerHits,
    fiberTimeSeconds: fiberTime,
    towerDelaySeconds,
    internalTimeSeconds: fiberTime + towerDelaySeconds,
  };
}