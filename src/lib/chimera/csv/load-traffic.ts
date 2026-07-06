import { readFileSync, existsSync } from "node:fs";

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
export function loadTrafficHistory(csvPath: string): TrafficRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Traffic history file does not exist at: ${csvPath}`);
  }

  const content = readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/);
  const rows: TrafficRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 5) continue;

    const link_id = parts[0]!.trim();
    const tick = parseInt(parts[1]!.trim(), 10);
    const load_units = parts[2]?.trim() ? parseFloat(parts[2].trim()) : 0;
    const load_ratio = parseFloat(parts[3]!.trim());
    const status = parts[4]!.trim() as "ok" | "saturated";
    const observed_latency_ms = parts[5]?.trim() ? parseFloat(parts[5].trim()) : null;

    rows.push({
      link_id,
      tick,
      load_units,
      load_ratio,
      status,
      observed_latency_ms,
    });
  }

  return rows;
}
