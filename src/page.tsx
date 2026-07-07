import { describe, expect, it } from "vitest";

import { MAX_PAYLOAD_CHARS } from "@/lib/api/constants";

import { GET as healthGet } from "./health/route";
import { POST as routePost } from "./route/route";
import { POST as transmitPost } from "./transmit/route";
import { GET as universeGet } from "./universe/route";

describe("API integration", () => {
  describe("GET /api/health", () => {
    it("returns ok with version and engine metadata including Phase 2 fields", async () => {
      const res = await healthGet();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        status: string;
        version: string;
        engine_loaded: boolean;
        models_loaded: boolean;
        config_hash: string;
        chimera_reachable: boolean;
        last_tick: number | null;
      };
      expect(body.status).toBe("ok");
      expect(body.engine_loaded).toBe(true);
      expect(body.models_loaded).toBe(true);
      expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(body.config_hash).toBeTruthy();
      // chimera_reachable is boolean (may be false in CI); last_tick is null or number
      expect(typeof body.chimera_reachable).toBe("boolean");
      expect(body.last_tick === null || typeof body.last_tick === "number").toBe(true);
    });
  });

  describe("POST /api/route", () => {
    it("returns Phase2RoutingReport for NL request from Aegis to Caelum", async () => {
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
      expect(Array.isArray(body.chosen_path)).toBe(true);
      expect(body.chosen_path.length).toBeGreaterThan(0);
      expect(body.chosen_path[0]).toBe("Aegis");
      expect(body.chosen_path[body.chosen_path.length - 1]).toBe("Caelum");
      expect(Array.isArray(body.link_evaluations)).toBe(true);
      expect(typeof body.final_latency_estimate_ms).toBe("number");
      expect(body.final_latency_estimate_ms).toBeGreaterThan(0);
      expect(typeof body.explanation).toBe("string");
      expect(body.explanation.length).toBeGreaterThan(0);
    });

    it("returns Phase2RoutingReport for structured request", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_id: "Boreas",
            destination_id: "Fenix",
            payload: "test message",
          }),
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
      expect(body.origin_id).toBe("Boreas");
      expect(body.destination_id).toBe("Fenix");
      expect(body.chosen_path.length).toBeGreaterThan(0);
      expect(body.link_evaluations).toBeDefined();
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

    it("returns 400 for missing request fields", async () => {
      const res = await routePost(
        new Request("http://localhost/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wrong_field: "oops" }),
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("VALIDATION_ERROR");
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
