/**
 * CSV loader for `link_incident_history.csv`.
 *
 * Owner: Ruwan (Phase 1 — section 1.1)
 *
 * Columns (see challenge p2/DATASETS.md):
 *   link_id, tick, traffic_share, jammed_flag
 *
 * Used to train the targeting-risk model:
 *  - Features: traffic_share, rolling share history, link prior
 *  - Target: jammed_flag (boolean)
 */

// TODO (Ruwan — Phase 1): implement incident history CSV loader

export interface IncidentRow {
  link_id: string;
  tick: number;
  /** Fraction of total interplanetary traffic on this link (0–1). */
  traffic_share: number;
  /** True if Chimera successfully disrupted this link during this tick. */
  jammed_flag: boolean;
}

/** Load and parse link_incident_history.csv from the given file path. */
export function loadIncidentHistory(_csvPath: string): IncidentRow[] {
  throw new Error("loadIncidentHistory() not yet implemented — Phase 1 task.");
}
