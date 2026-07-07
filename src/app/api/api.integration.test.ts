import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PAYLOAD_CHARS, RATE_LIMIT_MAX_REQUESTS } from "@/lib/api/constants";
import { resetRateLimitStore } from "@/lib/api/rate-limit";
import { chimeraClient } from "@/lib/chimera/client";
import type { ChimeraLinkState } from "@/lib/chimera/types";
import { clearEngineCache } from "@/lib/relic/server/universe";

import { GET as healthGet } from "./health/route";
import { POST as routePost } from "./route/route";
import { POST as transmitPost } from "./transmit/route";
import { GET as universeGet } from "./universe/route";

function buildHealthyState(
  links: Array<{ link_id: string; planet_a: string; planet_b: string }>,
) {
  return {
    tick: 42,
    links: links.map((link): ChimeraLinkState => ({
      ...link,
      capacity_units: 150,
      current_load: 8,
      load_ratio: 0.08,
      self_reported_latency_ms: 9_999_999,
      traffic_share: 0.06,
      status: "ok",
    })),
  };
}

function mockChimeraForTests(): void {
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
  vi.spyOn(chimeraClient, "getState").mockResolvedValue(state);
  vi.spyOn(chimeraClient, "getLinks").mockResolvedValue({
    links: config.interplanetary_links.map((link) => ({
      link_id: link.link_id,
      planet_a: link.planet_a,
      planet_b: link.planet_b,
      capacity_units: 150,
    })),
  });
  vi.spyOn(chimeraClient, "getLinkState").mockImplementation((linkId) =>
    state.links.find((link) => link.link_id === linkId),
  );
}

describe("API integration", () => {
  beforeEach(() => {
    clearEngineCache();
    resetRateLimitStore();
    process.env.UNIVERSE_CONFIG_PATH = join(
      process.cwd(),
      "challenge p2/universe-config.json",
    );
    mockChimeraForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.UNIVERSE_CONFIG_PATH;
    clearEngineCache();
  });

  describe("GET /api/health", () => {
    it("returns ok with version, engine metadata, and Phase 2 fields", async () => {
      const res = await healthGet();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        status: string;
        version: string;
        engine_loaded: boolean;
        config_hash: string;
        models_loaded: boolean;
        chimera_reachable: boolean;
        last_tick: number | null;
      };
      expect(body.status).toBe("ok");
      expect(body.engine_loaded).toBe(true);
      expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(body.config_hash).toBeTruthy();
      expect(body.models_loaded).toBe(true);
      expect(typeof body.chimera_reachable).toBe("boolean");
      expect(body.last_tick === null || typeof body.last_tick === "number").toBe(true);
    });
  });

  describe("GET /api/universe", () => {
    it("returns Zeta-26 nodes and metadata", async () => {
      const res = await universeGet();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        metadata: { system_name: string };
        nodes: { id: string }[];
      };
      expect(body.metadata.system_name).toBe("Zeta-26");
      expect(body.nodes.length).toBeGreaterThanOrEqual(4);
      expect(res.headers.get("Cache-Control")).toContain("max-age");
    });
  });

  describe("POST /api/route", () => {
    it("routes a natural-language request via the Co-Pilot", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: "Send Hello world from Aegis to Caelum" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        origin_id: string;
        destination_id: string;
        chosen_path: string[];
        link_evaluations: unknown[];
        final_latency_estimate_ms: number;
        explanation: string;
      };
      expect(body.origin_id).toBe("Aegis");
      expect(body.destination_id).toBe("Caelum");
      expect(body.chosen_path[0]).toBe("Aegis");
      expect(body.chosen_path.at(-1)).toBe("Caelum");
      expect(body.link_evaluations.length).toBeGreaterThan(0);
      expect(body.final_latency_estimate_ms).toBeGreaterThan(0);
      expect(body.explanation.length).toBeGreaterThan(0);
    });

    it("routes a structured True Cost request", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_id: "Boreas",
            destination_id: "Fenix",
            payload: "status ping",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        origin_id: string;
        destination_id: string;
        chosen_path: string[];
      };
      expect(body.origin_id).toBe("Boreas");
      expect(body.destination_id).toBe("Fenix");
      expect(body.chosen_path.at(-1)).toBe("Fenix");
    });

    it("returns 400 for malformed JSON body", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("INVALID_JSON");
    });

    it("returns 400 when neither NL nor structured fields are provided", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foo: "bar" }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for unknown origin planet", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_id: "NoSuchPlanet",
            destination_id: "Caelum",
          }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 429 once a client exceeds the rate limit", async () => {
      const makeRequest = () =>
        routePost(
          new Request("http://localhost/api/route", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "203.0.113.77",
            },
            body: JSON.stringify({
              origin_id: "Boreas",
              destination_id: "Fenix",
              payload: "ping",
            }),
          }),
        );

      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
        const ok = await makeRequest();
        expect(ok.status).toBe(200);
      }

      const limited = await makeRequest();
      expect(limited.status).toBe(429);
      const body = (await limited.json()) as { code: string };
      expect(body.code).toBe("RATE_LIMITED");
    });
  });

  describe("POST /api/transmit", () => {
    it("delivers Hello world from Aegis to Caelum", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "Aegis",
            destination: "Caelum",
            payload: "Hello world",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        packet: { status: string; payload: string };
        route: { deliverable: boolean };
      };
      expect(body.packet.status).toBe("delivered");
      expect(body.route.deliverable).toBe(true);
      expect(body.packet.payload).toBe("Hello world");
    });

    it("attaches a Co-Pilot routing_report when use_copilot is true", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "Aegis",
            destination: "Caelum",
            payload: "Hello world",
            use_copilot: true,
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        packet: { status: string };
        routing_report: {
          origin_id: string;
          destination_id: string;
          chosen_path: string[];
        } | null;
        routing_report_error: string | null;
      };
      expect(body.packet.status).toBe("delivered");
      expect(body.routing_report_error).toBeNull();
      expect(body.routing_report?.origin_id).toBe("Aegis");
      expect(body.routing_report?.destination_id).toBe("Caelum");
      expect(body.routing_report?.chosen_path.at(-1)).toBe("Caelum");
    });

    it("omits routing_report when use_copilot is not set", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "Aegis",
            destination: "Caelum",
            payload: "Hello world",
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty("routing_report");
    });

    it("returns undeliverable when origin is blocked", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "Aegis",
            destination: "Caelum",
            payload: "test",
            blockedNodes: ["Aegis"],
          }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        packet: { status: string };
        route: { deliverable: boolean; reason?: string };
      };
      expect(body.packet.status).toBe("undeliverable");
      expect(body.route.deliverable).toBe(false);
      expect(body.route.reason).toBeTruthy();
    });

    it("returns 400 for malformed JSON body", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("INVALID_JSON");
    });

    it("returns 400 for missing required fields", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: "Aegis" }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 413 for oversized payload", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "Aegis",
            destination: "Caelum",
            payload: "x".repeat(MAX_PAYLOAD_CHARS + 1),
          }),
        }),
      );
      expect(res.status).toBe(413);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("returns 400 for unknown origin planet", async () => {
      const res = await transmitPost(
        new Request("http://localhost/api/transmit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: "NoSuchPlanet",
            destination: "Caelum",
            payload: "test",
          }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });
});
