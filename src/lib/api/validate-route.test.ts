import { describe, expect, it } from "vitest";

import { MAX_PAYLOAD_CHARS } from "./constants";
import { validateRouteBody } from "./validate-route";

describe("validateRouteBody", () => {
  it("accepts a natural-language request body", () => {
    const result = validateRouteBody({
      request: "Send Hello world from Aegis to Caelum",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        mode: "nl",
        request: "Send Hello world from Aegis to Caelum",
      });
    }
  });

  it("accepts a structured True Cost body", () => {
    const result = validateRouteBody({
      origin_id: "Boreas",
      destination_id: "Fenix",
      payload: "ping",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        mode: "structured",
        origin_id: "Boreas",
        destination_id: "Fenix",
        payload: "ping",
      });
    }
  });

  it("defaults payload to empty string when omitted", () => {
    const result = validateRouteBody({
      origin_id: "Aegis",
      destination_id: "Caelum",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.data.mode === "structured") {
      expect(result.data.payload).toBe("");
    }
  });

  it("rejects non-object bodies", () => {
    const result = validateRouteBody(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects bodies missing both modes", () => {
    const result = validateRouteBody({ foo: "bar" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects identical origin and destination", () => {
    const result = validateRouteBody({
      origin_id: "Aegis",
      destination_id: "Aegis",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects oversized NL request text", () => {
    const result = validateRouteBody({ request: "x".repeat(MAX_PAYLOAD_CHARS + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("PAYLOAD_TOO_LARGE");
    }
  });
});
