/**
 * CSV loader for `link_telemetry.csv`.
 *
 * Owner: Ruwan (Phase 1 — section 1.1)
 *
 * Columns (see challenge p2/DATASETS.md):
 *   link_id, tick, self_reported_latency_ms, measured_latency_ms
 *
 * Used to train the trust/reliability model:
 *  - Compute per-link historical delta (self-reported vs measured)
 *  - Flag systematic under-reporting (Chimera spoofing) vs honest noise
 */

// TODO (Ruwan — Phase 1): implement telemetry CSV loader

export interface TelemetryRow {
  link_id: string;
  tick: number;
  self_reported_latency_ms: number;
  measured_latency_ms: number;
}

/** Load and parse link_telemetry.csv from the given file path. */
export function loadTelemetry(_csvPath: string): TelemetryRow[] {
  throw new Error("loadTelemetry() not yet implemented — Phase 1 task.");
}
