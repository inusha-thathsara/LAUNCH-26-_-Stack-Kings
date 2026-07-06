import { readFileSync, existsSync } from "node:fs";

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

export interface TelemetryRow {
  link_id: string;
  tick: number;
  self_reported_latency_ms: number;
  measured_latency_ms: number;
}

/** Load and parse link_telemetry.csv from the given file path. */
export function loadTelemetry(csvPath: string): TelemetryRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Telemetry file does not exist at: ${csvPath}`);
  }

  const content = readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/);
  const rows: TelemetryRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 4) continue;

    const link_id = parts[0]!.trim();
    const tick = parseInt(parts[1]!.trim(), 10);
    const self_reported_latency_ms = parseFloat(parts[2]!.trim());
    const measured_latency_ms = parseFloat(parts[3]!.trim());

    rows.push({
      link_id,
      tick,
      self_reported_latency_ms,
      measured_latency_ms,
    });
  }

  return rows;
}
