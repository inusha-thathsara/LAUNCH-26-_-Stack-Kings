import { expect, test } from "@playwright/test";

const MOCK_ROUTING_REPORT = {
  origin_id: "Aegis",
  destination_id: "Caelum",
  chosen_path: ["Aegis", "Boreas", "Caelum"],
  link_evaluations: [
    {
      link_id: "Aegis-Boreas",
      predicted_congestion_penalty_ms: 1200,
      trust_score: 0.92,
      targeting_risk_score: 0.15,
      combined_cost: 45000,
    },
    {
      link_id: "Boreas-Caelum",
      predicted_congestion_penalty_ms: 800,
      trust_score: 0.45,
      targeting_risk_score: 0.72,
      combined_cost: 52000,
    },
  ],
  final_latency_estimate_ms: 125000.5,
  explanation:
    'Co-Pilot routed "Hello world" from Aegis to Caelum via Aegis → Boreas → Caelum (parsed by rules layer). Baseline physics path was Aegis → Dawn → Caelum. One reroute applied.',
};

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

  test("Co-Pilot NL route shows evaluations panel and explanation", async ({
    page,
  }) => {
    await page.route("**/api/route", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ROUTING_REPORT),
      });
    });

    await page.goto("/relic");

    await expect(
      page.getByRole("heading", { name: /Zeta-26 Telemetry Console/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page
      .getByTestId("nl-copilot-input")
      .fill("Send Hello world from Aegis to Caelum");
    await page.getByTestId("copilot-route-button").click();

    await expect(page.getByTestId("parsed-intent")).toContainText("Aegis");
    await expect(page.getByTestId("parsed-intent")).toContainText("Caelum");
    await expect(page.getByTestId("copilot-explanation")).toBeVisible();
    await expect(page.getByTestId("link-evaluations-panel")).toBeVisible();
    await expect(page.getByTestId("link-eval-row-Aegis-Boreas")).toBeVisible();
    await expect(page.getByTestId("intelligence-summary")).toBeVisible();
  });

  test("chaos scenario still works alongside Co-Pilot routing", async ({ page }) => {
    await page.route("**/api/route", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ROUTING_REPORT),
      });
    });

    await page.goto("/relic");

    await expect(page.getByTestId("transmission-status")).toHaveText(/delivered/i, {
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Hyper-Flare/i }).click();

    await expect(page.getByTestId("transmission-status")).toHaveText(
      /delivered|undeliverable/i,
      { timeout: 15_000 },
    );

    await page.getByTestId("copilot-route-button").click();

    await expect(page.getByTestId("link-evaluations-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("copilot-explanation")).toBeVisible();
  });

  test("live chaos monitor activates after a Co-Pilot route", async ({ page }) => {
    await page.route("**/api/route", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ROUTING_REPORT),
      });
    });

    await page.goto("/relic");

    await expect(
      page.getByRole("heading", { name: /Zeta-26 Telemetry Console/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Live monitor is disabled until a route exists.
    await expect(page.getByTestId("live-monitor-toggle")).toBeDisabled();

    await page.getByTestId("copilot-route-button").click();
    await expect(page.getByTestId("copilot-explanation")).toBeVisible();

    await page.getByTestId("live-monitor-toggle").click();
    await expect(page.getByTestId("live-monitor-toggle")).toContainText(
      /live monitor on/i,
    );
  });

  test("live monitor surfaces a pivot banner when the path changes", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/route", async (route) => {
      calls += 1;
      // First response: original path; subsequent live polls: pivoted path.
      const body =
        calls <= 1
          ? MOCK_ROUTING_REPORT
          : { ...MOCK_ROUTING_REPORT, chosen_path: ["Aegis", "Dawn", "Caelum"] };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/relic");

    await expect(
      page.getByRole("heading", { name: /Zeta-26 Telemetry Console/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("copilot-route-button").click();
    await expect(page.getByTestId("copilot-explanation")).toBeVisible();

    await page.getByTestId("live-monitor-toggle").click();

    // The 4s poll picks up the pivoted path and animates the banner.
    await expect(page.getByTestId("pivot-notice")).toBeVisible({ timeout: 12_000 });
    await expect(page.getByTestId("pivot-notice")).toContainText(/pivoted/i);
  });
});
