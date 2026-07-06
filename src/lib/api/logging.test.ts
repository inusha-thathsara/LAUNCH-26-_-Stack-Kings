import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { logApiRequest } from "./logging";

describe("logApiRequest", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info level for successful responses", () => {
    logApiRequest({
      route: "/api/health",
      method: "GET",
      status: 200,
      duration_ms: 12,
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload.level).toBe("info");
    expect(payload.route).toBe("/api/health");
    expect(payload.status).toBe(200);
  });

  it("logs error level for 5xx responses", () => {
    logApiRequest({
      route: "/api/transmit",
      method: "POST",
      status: 500,
      duration_ms: 40,
      error: "engine failure",
    });

    expect(errorSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(payload.level).toBe("error");
    expect(payload.error).toBe("engine failure");
  });
});
