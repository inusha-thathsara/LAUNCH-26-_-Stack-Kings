/**
 * Canonical link ID helper for the Chimera Co-Pilot module.
 *
 * The Council schema requires `link_id` strings to always combine two planet
 * IDs in **alphabetical order** joined by a dash (e.g. "Aegis-Boreas", never
 * "Boreas-Aegis"). This mirrors the `edgeKey` convention in
 * {@link src/lib/relic/graph.ts} but uses `-` as separator instead of `|`,
 * matching the `universe-config.json` schema and the API response format.
 */

/**
 * Return the canonical interplanetary link identifier for a pair of planets.
 * The two planet IDs are sorted lexicographically before joining, so the
 * result is always the same regardless of argument order.
 *
 * @example
 * canonicalLinkId("Boreas", "Aegis") // => "Aegis-Boreas"
 * canonicalLinkId("Aegis", "Boreas") // => "Aegis-Boreas"
 */
export function canonicalLinkId(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
