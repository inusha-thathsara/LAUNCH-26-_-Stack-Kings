import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeWithCopilot } from "./agent/copilot";
import { chimeraClient } from "./client";
import { routeWithTrueCost } from "./router/true-cost-router";
import type { ChimeraLinkState } from "./types";
import { clearEngineCache } from "../relic/server/universe";

function buildHealthyState(
  links: Array<{ link_id: string; planet_a: string; planet_b: string }>,
) {
  return {
    tick: 99,
    links: links.map((link): ChimeraLinkState => ({
      ...link,
      capacity_units: 150,
      current_load: 8,
      load_ratio: 0.08,
      // High self-report avoids false low-trust blocks in the trust model during tests.
      self_reported_latency_ms: 9_999_999,
      traffic_share: 0.06,
      status: "ok",
    })),
  };
}

describe("Phase 2 routing", () => {
  beforeEach(() => {
    clearEngineCache();
    process.env.UNIVERSE_CONFIG_PATH = join(
      process.cwd(),
      "challenge p2/universe-config.json",
    );

    const config = JSON.parse(
      readFileSync(join(process.cwd(), "challenge p2/universe-config.json"), "utf8"),
    ) as {
      interplanetary_links: Array<{
        link_id: string;
        planet_a: string;
        planet_b: string;
      }>;
    };

    vi.spyOn(chimeraClient, "getState").mockResolvedValue(
      buildHealthyState(config.interplanetary_links),
    );
    vi.spyOn(chimeraClient, "getLinkState").mockImplementation((linkId) =>
      buildHealthyState(config.interplanetary_links).links.find(
        (link) => link.link_id === linkId,
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.UNIVERSE_CONFIG_PATH;
    clearEngineCache();
  });

  it("routeWithTrueCost returns a complete Phase2RoutingReport", async () => {
    const report = await routeWithTrueCost({
      origin_id: "Aegis",
      destination_id: "Caelum",
      payload: "ping",
    });

    expect(report.origin_id).toBe("Aegis");
    expect(report.destination_id).toBe("Caelum");
    expect(report.chosen_path[0]).toBe("Aegis");
    expect(report.chosen_path.at(-1)).toBe("Caelum");
    expect(report.link_evaluations).toHaveLength(report.chosen_path.length - 1);
    expect(report.final_latency_estimate_ms).toBeGreaterThan(0);
    expect(report.explanation.length).toBeGreaterThan(20);
  });

  it("routeWithCopilot parses NL input and returns Phase2RoutingReport", async () => {
    const report = await routeWithCopilot('Send "status ping" from Aegis to Caelum');

    expect(report.origin_id).toBe("Aegis");
    expect(report.destination_id).toBe("Caelum");
    expect(report.chosen_path.at(-1)).toBe("Caelum");
    expect(report.link_evaluations.length).toBeGreaterThan(0);
    expect(report.explanation).toMatch(/Co-Pilot routed/);
  });

  it("routeWithCopilot reroutes when the next hop is saturated", async () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "challenge p2/universe-config.json"), "utf8"),
    ) as {
      interplanetary_links: Array<{
        link_id: string;
        planet_a: string;
        planet_b: string;
      }>;
    };

    const state = buildHealthyState(config.interplanetary_links);
    const saturated = state.links.find((link) => link.link_id === "Aegis-Dawn");
    if (saturated) {
      saturated.status = "saturated";
      saturated.self_reported_latency_ms = null;
      saturated.load_ratio = 0.95;
    }

    vi.spyOn(chimeraClient, "getState").mockResolvedValue(state);
    vi.spyOn(chimeraClient, "getLinkState").mockImplementation((linkId) =>
      state.links.find((link) => link.link_id === linkId),
    );

    const report = await routeWithCopilot("from Aegis to Caelum");
    expect(report.chosen_path[0]).toBe("Aegis");
    expect(report.chosen_path.at(-1)).toBe("Caelum");
    expect(report.explanation).toMatch(/reroute/i);
  });
});
