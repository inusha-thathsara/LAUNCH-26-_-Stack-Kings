import { describe, expect, it } from "vitest";

import {
  MAX_BLOCKED_EDGES,
  MAX_BLOCKED_NODES,
  MAX_PAYLOAD_CHARS,
} from "./constants";
import { validateTransmitBody } from "./validate-transmit";

describe("validateTransmitBody", () => {
  it("accepts a valid body", () => {
    const result = validateTransmitBody({
      origin: "Aegis",
      destination: "Caelum",
      payload: "Hello world",
      blockedNodes: ["Dawn"],
      blockedEdges: [["Aegis", "Boreas"]],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.origin).toBe("Aegis");
      expect(result.data.options.blockedNodes).toEqual(["Dawn"]);
    }
  });

  it("rejects non-object bodies", () => {
    const result = validateTransmitBody(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects missing string fields", () => {
    const result = validateTransmitBody({ origin: "Aegis" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("rejects oversized payloads with 413", () => {
    const result = validateTransmitBody({
      origin: "A",
      destination: "B",
      payload: "x".repeat(MAX_PAYLOAD_CHARS + 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.body.code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("rejects oversized blocked node lists", () => {
    const result = validateTransmitBody({
      origin: "A",
      destination: "B",
      payload: "hi",
      blockedNodes: Array.from({ length: MAX_BLOCKED_NODES + 1 }, (_, i) =>
        String(i),
      ),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("BLOCKED_LIST_TOO_LARGE");
    }
  });

  it("rejects oversized blocked edge lists", () => {
    const result = validateTransmitBody({
      origin: "A",
      destination: "B",
      payload: "hi",
      blockedEdges: Array.from({ length: MAX_BLOCKED_EDGES + 1 }, (_, i) => [
        `N${i}`,
        `M${i}`,
      ]),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body.code).toBe("BLOCKED_LIST_TOO_LARGE");
    }
  });
});
