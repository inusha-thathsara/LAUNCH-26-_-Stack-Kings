import { expect, test } from "@playwright/test";

test.describe("Relic telemetry dashboard", () => {
  test("loads universe and shows route, latency, and codex panels", async ({
    page,
  }) => {
    await page.goto("/relic");

    await expect(
      page.getByRole("heading", { name: /Zeta-26 Telemetry Console/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByTestId("transmission-status")).toHaveText(/delivered/i, {
      timeout: 15_000,
    });

    await expect(
      page.getByRole("heading", { name: /Latency & Propagation Telemetry/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Codex Dialect Terminal/i }),
    ).toBeVisible();
    await expect(page.getByTestId("codex-hop-tab").first()).toBeVisible();
  });

  test("hyper-flare scenario reroutes around severed links", async ({ page }) => {
    await page.goto("/relic");

    await expect(page.getByTestId("transmission-status")).toHaveText(/delivered/i, {
      timeout: 15_000,
    });

    const latencyBefore = await page.getByTestId("total-latency-ms").textContent();

    await page.getByRole("button", { name: /Hyper-Flare/i }).click();

    await expect(page.getByTestId("transmission-status")).toHaveText(
      /delivered|undeliverable/i,
      { timeout: 15_000 },
    );

    const status = await page.getByTestId("transmission-status").textContent();
    if (status?.match(/delivered/i)) {
      await expect(page.getByTestId("codex-hop-tab").first()).toBeVisible();
      const latencyAfter = await page.getByTestId("total-latency-ms").textContent();
      expect(latencyAfter).toBeTruthy();
      expect(latencyBefore).toBeTruthy();
    } else {
      await expect(page.getByTestId("undeliverable-reason")).toBeVisible();
    }
  });

  test("manual transmit updates codex terminal", async ({ page }) => {
    await page.goto("/relic");

    await expect(page.getByTestId("transmission-status")).toHaveText(/delivered/i, {
      timeout: 15_000,
    });

    await page.getByLabel(/Payload Message/i).fill("Hi");
    await page.getByRole("button", { name: /Initiate Void Beam/i }).click();

    await expect(page.getByTestId("transmission-status")).toHaveText(/delivered/i, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("codex-hop-tab").first()).toBeVisible();
  });
});
