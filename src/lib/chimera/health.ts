/**
 * Chimera health probes for GET /api/health (Phase 3).
 *
 * Server-side only.
 */

import congestionModel from "./models/congestion.model.json";
import targetingModel from "./models/targeting.model.json";
import trustModel from "./models/trust.model.json";
import { chimeraClient, getLastChimeraTick } from "./client";

export interface ChimeraHealthSnapshot {
  models_loaded: boolean;
  chimera_reachable: boolean;
  last_tick: number | null;
}

/** True when all three runtime model JSON artifacts are present and non-empty. */
export function areModelsLoaded(): boolean {
  const congestion = congestionModel as Record<string, unknown>;
  const trust = trustModel as { compromised_links?: Record<string, unknown> };
  const targeting = targetingModel as Record<string, unknown>;

  return (
    Object.keys(congestion).length > 0 &&
    typeof trust.compromised_links === "object" &&
    Object.keys(targeting).length > 0
  );
}

/**
 * Non-blocking reachability probe against Chimera GET /links (no auth required).
 * Returns false on any network or HTTP failure.
 */
export async function probeChimeraReachable(): Promise<boolean> {
  try {
    await chimeraClient.getLinks();
    return true;
  } catch {
    return false;
  }
}

/** Collect Chimera-related health fields for the API health endpoint. */
export async function getChimeraHealthSnapshot(): Promise<ChimeraHealthSnapshot> {
  const [chimera_reachable] = await Promise.all([probeChimeraReachable()]);
  return {
    models_loaded: areModelsLoaded(),
    chimera_reachable,
    last_tick: getLastChimeraTick() ?? null,
  };
}
