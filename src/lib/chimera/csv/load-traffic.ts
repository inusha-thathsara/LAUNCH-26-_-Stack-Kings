/**
 * CSV loader for `link_traffic_history.csv`.
 *
 * Owner: Ruwan (Phase 1 — section 1.1)
 *
 * Columns (see challenge p2/DATASETS.md):
 *   link_id, tick, load_units, load_ratio, status, observed_latency_ms
 *
 * Notes:
 *  - `observed_latency_ms` is null/empty when status === "saturated"
 *  - Group rows by link_id for per-link model training
 */

// TODO (Ruwan — Phase 1): implement traffic CSV loader

export interface TrafficRow {
  link_id: string;
  tick: number;
  load_units: number;
  load_ratio: number;
  status: "ok" | "saturated";
  /** Null when link is saturated. */
  observed_latency_ms: number | null;
}

/** Load and parse link_traffic_history.csv from the given file path. */
export function loadTrafficHistory(_csvPath: string): TrafficRow[] {
  throw new Error("loadTrafficHistory() not yet implemented — Phase 1 task.");
}
