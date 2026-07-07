import { afterEach, describe, expect, it, vi } from "vitest";

import { ChimeraClient } from "./client";
import type { ChimeraLinkState } from "./types";

function okLink(
  link: Partial<ChimeraLinkState> &
    Pick<ChimeraLinkState, "link_id" | "planet_a" | "planet_b">,
): ChimeraLinkState {
  return {
    capacity_units: 100,
    current_load: 5,
    load_ratio: 0.05,
    self_reported_latency_ms: 120,
    traffic_share: 0.08,
    status: "ok",
    ...link,
  };
}

describe("ChimeraClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches /links without auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          links: [
            {
              link_id: "Aegis-Boreas",
              planet_a: "Aegis",
              planet_b: "Boreas",
              capacity_units: 200,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      fetchFn,
    });

    const links = await client.getLinks();
    expect(links.links).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledWith("https://example.test/links");
  });

  it("fetches /state with X-Team-Key and caches by tick interval", async () => {
    const stateBody = {
      tick: 7,
      links: [
        okLink({ link_id: "Aegis-Boreas", planet_a: "Aegis", planet_b: "Boreas" }),
      ],
    };

    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(stateBody), { status: 200 }));

    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "test-key",
      fetchFn,
      pollIntervalMs: 60_000,
    });

    const first = await client.getState();
    const second = await client.getState();

    expect(first.tick).toBe(7);
    expect(second.tick).toBe(7);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith("https://example.test/state", {
      headers: { "X-Team-Key": "test-key" },
    });
    expect(client.getLastTick()).toBe(7);
    expect(client.getLinkState("Aegis-Boreas")?.load_ratio).toBe(0.05);
  });

  it("throws on 401 from /state", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "bad-key",
      fetchFn,
    });

    await expect(client.getState(true)).rejects.toThrow(/401/);
  });

  it("throws when team key is missing", async () => {
    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "",
      fetchFn: vi.fn(),
    });

    await expect(client.getState(true)).rejects.toThrow(/CHIMERA_TEAM_KEY/);
  });

  it("throws on a malformed /state response (missing tick)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ links: [] }), { status: 200 }));
    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "test-key",
      fetchFn,
    });

    await expect(client.getState(true)).rejects.toThrow(/Malformed Chimera \/state/);
  });

  it("throws on a malformed /state response (invalid link entry)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tick: 3,
          links: [{ link_id: "Aegis-Boreas", planet_a: "Aegis" }],
        }),
        { status: 200 },
      ),
    );
    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "test-key",
      fetchFn,
    });

    await expect(client.getState(true)).rejects.toThrow(/invalid link state/);
  });

  it("throws on a malformed /links response", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ notLinks: true }), { status: 200 }),
      );
    const client = new ChimeraClient({ baseUrl: "https://example.test", fetchFn });

    await expect(client.getLinks()).rejects.toThrow(/Malformed Chimera \/links/);
  });

  it("accepts null self_reported_latency_ms for saturated links", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tick: 5,
          links: [
            {
              link_id: "Aegis-Boreas",
              planet_a: "Aegis",
              planet_b: "Boreas",
              capacity_units: 100,
              current_load: 100,
              load_ratio: 1,
              self_reported_latency_ms: null,
              traffic_share: 0.2,
              status: "saturated",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new ChimeraClient({
      baseUrl: "https://example.test",
      teamKey: "test-key",
      fetchFn,
    });

    const state = await client.getState(true);
    expect(state.links[0]?.self_reported_latency_ms).toBeNull();
    expect(state.links[0]?.status).toBe("saturated");
  });
});
