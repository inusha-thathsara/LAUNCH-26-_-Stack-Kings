/**
 * Trust / reliability model.
 *
 * Owner: Ruwan (Phase 1 — section 1.3)
 *
 * Training data: link_telemetry.csv
 * Features: per-link historical delta distribution (self_reported vs measured)
 * Output: trust_score 0–1 (high = believe self-report; low = Chimera spoofing)
 *
 * Approach:
 *  - Flagged as spoofed when systematic under-reporting exceeds noise threshold
 *  - Runtime: live self_reported_latency_ms compared against expected honest range
 *  - Low trust → inflate combined_cost for that link
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PlanetNode } from "../../relic/types";
import type { ChimeraLinkState } from "../types";
import { predictCongestion } from "./congestion";
import trustModelData from "./trust.model.json";

interface CompromisedLinkInfo {
  mean_delta_ms: number;
  std_delta_ms: number;
}

interface TrustModelSchema {
  compromised_links: Record<string, CompromisedLinkInfo>;
}

const TRUST_MODEL: TrustModelSchema = trustModelData;

// Simple cache for Tv values to avoid loading config file on every call
const tvCache = new Map<string, number>();

/** Helper to compute Tv dynamically from the active universe config file. */
function getTvForLink(planetA: string, planetB: string): number {
  const cacheKey = `${planetA}-${planetB}`;
  if (tvCache.has(cacheKey)) {
    return tvCache.get(cacheKey)!;
  }

  // Find universe config path (same fallback chain as universeConfigPath())
  let configPath = join(process.cwd(), "universe-config.json");
  const candidates = [
    join(process.cwd(), "challenge p2/universe-config.json"),
    join(process.cwd(), "challenge p1/universe-config.json"),
    join(process.cwd(), "universe-config.json"),
  ];

  if (process.env.UNIVERSE_CONFIG_PATH) {
    configPath = process.env.UNIVERSE_CONFIG_PATH;
  } else {
    for (const cand of candidates) {
      if (existsSync(cand)) {
        configPath = cand;
        break;
      }
    }
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const metadata = parsed.universe_metadata;
    const nodes = parsed.nodes as PlanetNode[];

    const nodeA = nodes.find((n) => n.id === planetA);
    const nodeB = nodes.find((n) => n.id === planetB);

    if (!nodeA || !nodeB) {
      throw new Error(`Nodes not found: ${planetA} or ${planetB}`);
    }

    const scale = metadata.coordinate_scale_unit_km;
    const dx = (nodeA.x - nodeB.x) * scale;
    const dy = (nodeA.y - nodeB.y) * scale;
    const distanceKm = Math.sqrt(dx * dx + dy * dy);
    const c = metadata.speed_of_light_kms;

    const refractDist =
      nodeA.atmosphere_thickness_km * nodeA.refraction_index +
      nodeB.atmosphere_thickness_km * nodeB.refraction_index;

    const atmosphere_ms = (refractDist / c) * 1000;
    const void_ms = (distanceKm / c) * 1000;
    const tv = atmosphere_ms + void_ms;

    tvCache.set(cacheKey, tv);
    return tv;
  } catch (error) {
    console.error(
      `[TrustModel] Failed to load config to compute Tv for ${planetA}-${planetB}:`,
      error,
    );
    // Hardcoded fallbacks as emergency return
    const fallbacks: Record<string, number> = {
      "Aegis-Boreas": 60093.219,
      "Aegis-Dawn": 118433.718,
      "Aegis-Elysium": 153398.63,
      "Boreas-Dawn": 74615.865,
      "Boreas-Elysium": 88072.531,
      "Boreas-Fenix": 127007.732,
      "Caelum-Dawn": 115464.29,
      "Caelum-Elysium": 127842.352,
      "Caelum-Fenix": 99770.992,
      "Dawn-Elysium": 105640.067,
      "Dawn-Fenix": 77793.73,
      "Elysium-Fenix": 109559.147,
    };
    return fallbacks[cacheKey] || 100000; // global emergency default
  }
}

/**
 * Score how trustworthy the link's self-reported latency is.
 *
 * @param linkState - Live state from Chimera /state endpoint
 * @returns trust_score in [0, 1]; 1.0 = fully trustworthy, 0.0 = Chimera footprint
 */
export function scoreTrust(linkState: ChimeraLinkState): number {
  if (linkState.status === "saturated" || linkState.self_reported_latency_ms === null) {
    return 0.0;
  }

  const tv = getTvForLink(linkState.planet_a, linkState.planet_b);
  const congestion = predictCongestion(linkState, tv);
  const expectedLatency = tv + congestion.penalty_ms;
  const liveDelta = expectedLatency - linkState.self_reported_latency_ms;

  const compromisedInfo = TRUST_MODEL.compromised_links[linkState.link_id];

  if (compromisedInfo) {
    // Known compromised link. Check if the live delta matches the spoofing pattern.
    const ratio = liveDelta / compromisedInfo.mean_delta_ms;
    // If ratio is near 1, it matches spoofing. If ratio is <= 0, it behaves honestly.
    const trust = Math.max(0, Math.min(1, 1 - ratio));
    return parseFloat(trust.toFixed(4));
  } else {
    // Historically honest link. But let's check for "The Unseen Vector" (unseen spoofing).
    // Honest links have minor noise. If under-reporting delta exceeds 15,000ms, flag it.
    if (liveDelta > 15000) {
      const anomalyFactor = Math.max(0, Math.min(1, (liveDelta - 15000) / 30000));
      return parseFloat((1 - anomalyFactor).toFixed(4));
    }
    return 1.0;
  }
}
