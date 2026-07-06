import { readFileSync, existsSync } from "node:fs";

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

export interface IncidentRow {
  link_id: string;
  tick: number;
  /** Fraction of total interplanetary traffic on this link (0–1). */
  traffic_share: number;
  /** True if Chimera successfully disrupted this link during this tick. */
  jammed_flag: boolean;
}

/** Load and parse link_incident_history.csv from the given file path. */
export function loadIncidentHistory(csvPath: string): IncidentRow[] {
  if (!existsSync(csvPath)) {
    throw new Error(`Incident history file does not exist at: ${csvPath}`);
  }

  const content = readFileSync(csvPath, "utf8");
  const lines = content.split(/\r?\n/);
  const rows: IncidentRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 4) continue;

    const link_id = parts[0]!.trim();
    const tick = parseInt(parts[1]!.trim(), 10);
    const traffic_share = parts[2]?.trim() ? parseFloat(parts[2].trim()) : 0;
    const jammed_flag = parts[3]!.trim().toLowerCase() === "true";

    rows.push({
      link_id,
      tick,
      traffic_share,
      jammed_flag,
    });
  }

  return rows;
}
