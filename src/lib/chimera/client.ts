/**
 * Chimera API HTTP client stub.
 *
 * Owner: Inusha (Phase 2 — section 2.1)
 *
 * Responsibilities:
 *  - `getLinks()` → GET /links (no auth required)
 *  - `getState()` → GET /state with X-Team-Key header
 *  - Tick-aware in-memory cache (poll every ~1–2 s; no spam)
 *  - Explicit handling of 401, malformed responses, saturated links
 *
 * Environment variables consumed (set in .env / Vercel):
 *   CHIMERA_API_BASE_URL  — defaults to https://chimera.launch26.space
 *   CHIMERA_TEAM_KEY      — required for /state; never hardcode the real key
 *
 * This file is a server-side module only — never import from client components.
 */

// TODO (Inusha — Phase 2): implement ChimeraClient
// Stub types exported so the scaffold compiles from Day 1.

export interface ChimeraLinksResponse {
  links: Array<{
    link_id: string;
    planet_a: string;
    planet_b: string;
    capacity_units: number;
  }>;
}

export interface ChimeraStateResponse {
  tick: number;
  links: import("./types").ChimeraLinkState[];
}

// Placeholder — replace with real implementation in Phase 2
export class ChimeraClient {
  private readonly baseUrl: string;
  private readonly teamKey: string;

  constructor(
    baseUrl = process.env.CHIMERA_API_BASE_URL ?? "https://chimera.launch26.space",
    teamKey = process.env.CHIMERA_TEAM_KEY ?? "",
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.teamKey = teamKey;
  }

  /** GET /links — returns static link topology (no auth required). */
  async getLinks(): Promise<ChimeraLinksResponse> {
    throw new Error("ChimeraClient.getLinks() not yet implemented — Phase 2 task.");
  }

  /**
   * GET /state — returns live link states.
   * Requires CHIMERA_TEAM_KEY to be set.
   * @throws when the key is missing, 401 is returned, or the response is malformed.
   */
  async getState(): Promise<ChimeraStateResponse> {
    throw new Error("ChimeraClient.getState() not yet implemented — Phase 2 task.");
  }
}
