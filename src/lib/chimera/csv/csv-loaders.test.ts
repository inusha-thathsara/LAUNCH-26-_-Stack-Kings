import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { loadTrafficHistory } from "./load-traffic";
import { loadTelemetry } from "./load-telemetry";
import { loadIncidentHistory } from "./load-incidents";

describe("CSV Loaders", () => {
  const trafficPath = join(process.cwd(), "challenge p2/link_traffic_history.csv");
  const telemetryPath = join(process.cwd(), "challenge p2/link_telemetry.csv");
  const incidentPath = join(process.cwd(), "challenge p2/link_incident_history.csv");

  it("loads and parses traffic history CSV", () => {
    const traffic = loadTrafficHistory(trafficPath);
    expect(traffic.length).toBeGreaterThan(0);
    expect(traffic[0]).toHaveProperty("link_id");
    expect(traffic[0]).toHaveProperty("tick");
    expect(traffic[0]).toHaveProperty("load_units");
    expect(traffic[0]).toHaveProperty("load_ratio");
    expect(traffic[0]).toHaveProperty("status");
    expect(traffic[0]).toHaveProperty("observed_latency_ms");

    // check specific values for first row: Aegis-Boreas,0,90.0,0.4328,ok,118635.583
    const firstRow = traffic[0]!;
    expect(firstRow.link_id).toBe("Aegis-Boreas");
    expect(firstRow.tick).toBe(0);
    expect(firstRow.load_units).toBe(90.0);
    expect(firstRow.load_ratio).toBe(0.4328);
    expect(firstRow.status).toBe("ok");
    expect(firstRow.observed_latency_ms).toBeCloseTo(118635.583, 3);
  });

  it("loads and parses telemetry CSV", () => {
    const telemetry = loadTelemetry(telemetryPath);
    expect(telemetry.length).toBeGreaterThan(0);
    expect(telemetry[0]).toHaveProperty("link_id");
    expect(telemetry[0]).toHaveProperty("tick");
    expect(telemetry[0]).toHaveProperty("self_reported_latency_ms");
    expect(telemetry[0]).toHaveProperty("measured_latency_ms");

    // check specific values for first row: Aegis-Boreas,0,69804.794,70246.059
    const firstRow = telemetry[0]!;
    expect(firstRow.link_id).toBe("Aegis-Boreas");
    expect(firstRow.tick).toBe(0);
    expect(firstRow.self_reported_latency_ms).toBeCloseTo(69804.794, 3);
    expect(firstRow.measured_latency_ms).toBeCloseTo(70246.059, 3);
  });

  it("loads and parses incident history CSV", () => {
    const incidents = loadIncidentHistory(incidentPath);
    expect(incidents.length).toBeGreaterThan(0);
    expect(incidents[0]).toHaveProperty("link_id");
    expect(incidents[0]).toHaveProperty("tick");
    expect(incidents[0]).toHaveProperty("traffic_share");
    expect(incidents[0]).toHaveProperty("jammed_flag");

    // check specific values for first row: Aegis-Boreas,0,0.03833,False
    const firstRow = incidents[0]!;
    expect(firstRow.link_id).toBe("Aegis-Boreas");
    expect(firstRow.tick).toBe(0);
    expect(firstRow.traffic_share).toBeCloseTo(0.03833, 5);
    expect(firstRow.jammed_flag).toBe(false);
  });

  it("throws error when file does not exist", () => {
    expect(() => loadTrafficHistory("non-existent-path.csv")).toThrow();
  });
});
