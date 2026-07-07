import { describe, expect, it, beforeEach } from "vitest";

import { RATE_LIMIT_MAX_REQUESTS } from "./constants";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientKey,
  resetRateLimitStore,
} from "./rate-limit";

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

describe("getClientKey", () => {
  it("uses the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientKey(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(getClientKey(req)).toBe("198.51.100.9");
  });

  it("falls back to 'anonymous' when no client hint is present", () => {
    expect(getClientKey(new Request("http://x"))).toBe("anonymous");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("returns null while under the limit", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(enforceRateLimit(req)).toBeNull();
  });

  it("returns a 429 response once the limit is exceeded", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    });
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i += 1) {
      enforceRateLimit(req);
    }
    const blocked = enforceRateLimit(req);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });
});
