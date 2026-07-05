import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  clearEngineCache,
  getEngine,
  reloadEngine,
  UNIVERSE_CONFIG_ENV,
  universeConfigPath,
} from "./universe";

const ORIGINAL_ENV = process.env[UNIVERSE_CONFIG_ENV];

function minimalConfig() {
  return {
    universe_metadata: {
      system_name: "Temp",
      coordinate_scale_unit_km: 1,
    },
    nodes: [
      {
        id: "A",
        codex: 8,
        x: 0,
        y: 0,
        radius_km: 1,
        active_towers: 4,
        atmosphere_thickness_km: 0,
        refraction_index: 1,
      },
      {
        id: "B",
        codex: 5,
        x: 10,
        y: 0,
        radius_km: 1,
        active_towers: 4,
        atmosphere_thickness_km: 0,
        refraction_index: 1,
      },
    ],
  };
}

afterEach(() => {
  clearEngineCache();
  if (ORIGINAL_ENV === undefined) {
    delete process.env[UNIVERSE_CONFIG_ENV];
  } else {
    process.env[UNIVERSE_CONFIG_ENV] = ORIGINAL_ENV;
  }
});

describe("universe server loader", () => {
  it("defaults universeConfigPath to the repo root file", () => {
    delete process.env[UNIVERSE_CONFIG_ENV];
    expect(universeConfigPath()).toMatch(/universe-config\.json$/);
  });

  it("honours UNIVERSE_CONFIG_PATH", () => {
    const dir = mkdtempSync(join(tmpdir(), "relic-config-"));
    const customPath = join(dir, "custom-universe.json");
    writeFileSync(customPath, JSON.stringify(minimalConfig()), "utf8");
    process.env[UNIVERSE_CONFIG_ENV] = customPath;

    clearEngineCache();
    const engine = getEngine();
    expect(engine.universe.nodes).toHaveLength(2);
    expect(engine.universe.nodes[0].id).toBe("A");
  });

  it("reloadEngine rebuilds from disk after cache clear", () => {
    const dir = mkdtempSync(join(tmpdir(), "relic-config-"));
    const customPath = join(dir, "custom-universe.json");
    writeFileSync(customPath, JSON.stringify(minimalConfig()), "utf8");
    process.env[UNIVERSE_CONFIG_ENV] = customPath;

    clearEngineCache();
    getEngine();

    const updated = minimalConfig();
    updated.nodes.push({
      id: "C",
      codex: 10,
      x: 20,
      y: 0,
      radius_km: 1,
      active_towers: 4,
      atmosphere_thickness_km: 0,
      refraction_index: 1,
    });
    writeFileSync(customPath, JSON.stringify(updated), "utf8");

    const reloaded = reloadEngine();
    expect(reloaded.universe.nodes).toHaveLength(3);
  });
});
