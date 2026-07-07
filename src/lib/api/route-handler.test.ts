import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { handleApiRoute } from "./route-handler";

describe("handleApiRoute", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the handler response and logs the request", async () => {
    const response = await handleApiRoute("/api/test", "GET", async () =>
      Response.json({ ok: true }, { status: 200 }),
    );
    expect(response.status).toBe(200);
    expect(console.info).toHaveBeenCalledOnce();
  });

  it("rethrows after logging when the handler throws", async () => {
    await expect(
      handleApiRoute("/api/test", "POST", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
