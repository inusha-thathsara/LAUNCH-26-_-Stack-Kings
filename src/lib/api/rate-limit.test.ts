import { describe, expect, it, beforeEach } from "vitest";

import { RATE_LIMIT_MAX_REQUESTS } from "./constants";
import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      expect(checkRateLimit("client-a")).toBe(true);
    }
  });

  it("blocks requests over the limit for the same client", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkRateLimit("client-a");
    }
    expect(checkRateLimit("client-a")).toBe(false);
  });

  it("tracks clients independently", () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      checkRateLimit("client-a");
    }
    expect(checkRateLimit("client-b")).toBe(true);
  });
});
