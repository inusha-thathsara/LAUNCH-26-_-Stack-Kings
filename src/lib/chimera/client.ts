/**
 * Chimera API HTTP client.
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

import type { ChimeraLinkState } from "./types";
import { CHIMERA_POLL_INTERVAL_MS } from "./constants";

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
  links: ChimeraLinkState[];
}

export type ChimeraFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ChimeraClientOptions {
  baseUrl?: string;
  teamKey?: string;
  fetchFn?: ChimeraFetchFn;
  pollIntervalMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLinksResponse(body: unknown): ChimeraLinksResponse {
  if (!isRecord(body) || !Array.isArray(body.links)) {
    throw new Error("Malformed Chimera /links response: missing links array.");
  }
  for (const link of body.links) {
    if (
      !isRecord(link) ||
      typeof link.link_id !== "string" ||
      typeof link.planet_a !== "string" ||
      typeof link.planet_b !== "string" ||
      typeof link.capacity_units !== "number"
    ) {
      throw new Error("Malformed Chimera /links response: invalid link entry.");
    }
  }
  return body as unknown as ChimeraLinksResponse;
}

function parseStateResponse(body: unknown): ChimeraStateResponse {
  if (!isRecord(body) || typeof body.tick !== "number" || !Array.isArray(body.links)) {
    throw new Error("Malformed Chimera /state response: missing tick or links.");
  }
  for (const link of body.links) {
    if (
      !isRecord(link) ||
      typeof link.link_id !== "string" ||
      typeof link.planet_a !== "string" ||
      typeof link.planet_b !== "string" ||
      typeof link.capacity_units !== "number" ||
      typeof link.current_load !== "number" ||
      typeof link.load_ratio !== "number" ||
      (link.self_reported_latency_ms !== null &&
        typeof link.self_reported_latency_ms !== "number") ||
      typeof link.traffic_share !== "number" ||
      (link.status !== "ok" && link.status !== "saturated")
    ) {
      throw new Error("Malformed Chimera /state response: invalid link state.");
    }
  }
  return body as unknown as ChimeraStateResponse;
}

export class ChimeraClient {
  private readonly baseUrl: string;
  private readonly teamKey: string;
  private readonly fetchFn: ChimeraFetchFn;
  private readonly pollIntervalMs: number;

  private cachedState: ChimeraStateResponse | undefined;
  private lastFetchMs = 0;
  private inflightState: Promise<ChimeraStateResponse> | undefined;
  private linksById = new Map<string, ChimeraLinkState>();

  constructor(options: ChimeraClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.CHIMERA_API_BASE_URL ??
      "https://chimera.launch26.space"
    ).replace(/\/$/, "");
    this.teamKey = options.teamKey ?? process.env.CHIMERA_TEAM_KEY ?? "";
    this.fetchFn = options.fetchFn ?? fetch;
    this.pollIntervalMs = options.pollIntervalMs ?? CHIMERA_POLL_INTERVAL_MS;
  }

  /** Tick from the most recently cached `/state` response, if any. */
  getLastTick(): number | undefined {
    return this.cachedState?.tick;
  }

  /** Look up live link state by canonical link id from the tick cache. */
  getLinkState(linkId: string): ChimeraLinkState | undefined {
    return this.linksById.get(linkId);
  }

  /** GET /links — returns static link topology (no auth required). */
  async getLinks(): Promise<ChimeraLinksResponse> {
    const response = await this.fetchFn(`${this.baseUrl}/links`);
    if (!response.ok) {
      throw new Error(`Chimera /links failed with HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    return parseLinksResponse(body);
  }

  /**
   * GET /state — returns live link states.
   * Requires CHIMERA_TEAM_KEY to be set.
   * @throws when the key is missing, 401 is returned, or the response is malformed.
   */
  async getState(force = false): Promise<ChimeraStateResponse> {
    if (
      !force &&
      this.cachedState &&
      Date.now() - this.lastFetchMs < this.pollIntervalMs
    ) {
      return this.cachedState;
    }
    if (!force && this.inflightState) {
      return this.inflightState;
    }

    this.inflightState = this.fetchStateFromApi();
    try {
      const state = await this.inflightState;
      this.cachedState = state;
      this.lastFetchMs = Date.now();
      this.linksById = new Map(state.links.map((link) => [link.link_id, link]));
      return state;
    } finally {
      this.inflightState = undefined;
    }
  }

  /** Drop cached state (useful in tests). */
  clearCache(): void {
    this.cachedState = undefined;
    this.lastFetchMs = 0;
    this.linksById.clear();
  }

  private async fetchStateFromApi(): Promise<ChimeraStateResponse> {
    if (!this.teamKey) {
      throw new Error("CHIMERA_TEAM_KEY is required for Chimera /state requests.");
    }

    const response = await this.fetchFn(`${this.baseUrl}/state`, {
      headers: { "X-Team-Key": this.teamKey },
    });

    if (response.status === 401) {
      throw new Error("Chimera /state rejected the team key (HTTP 401).");
    }
    if (!response.ok) {
      throw new Error(`Chimera /state failed with HTTP ${response.status}.`);
    }

    const body: unknown = await response.json();
    return parseStateResponse(body);
  }
}

/** Process-wide singleton used by routing code and health checks. */
export const chimeraClient = new ChimeraClient();

/** Convenience accessor for the last observed Chimera simulation tick. */
export function getLastChimeraTick(): number | undefined {
  return chimeraClient.getLastTick();
}
