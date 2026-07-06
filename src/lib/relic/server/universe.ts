/**
 * Node-only helpers for loading the universe configuration from disk and
 * providing a cached engine instance to server code (API routes, CLI).
 *
 * This module uses the filesystem and must never be imported by client
 * components.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createEngine, type Engine } from "../engine";
import { RelicConfigError } from "../config";

/** Environment variable overriding the universe config file path. */
export const UNIVERSE_CONFIG_ENV = "UNIVERSE_CONFIG_PATH";

/** Absolute path to the universe configuration file. */
export function universeConfigPath(): string {
  const configured = process.env[UNIVERSE_CONFIG_ENV];
  if (configured && configured.trim().length > 0) {
    return configured;
  }
  return join(process.cwd(), "universe-config.json");
}

/** Read and parse the raw universe configuration JSON from disk. */
export function loadUniverseConfig(): unknown {
  const path = universeConfigPath();
  try {
    const text = readFileSync(path, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof RelicConfigError) throw error;
    const message =
      error instanceof Error ? error.message : "Failed to read universe config.";
    throw new RelicConfigError(
      `Could not load universe config from "${path}": ${message}`,
    );
  }
}

/** SHA-256 hash of the raw config file bytes (for health/deploy checks). */
export function universeConfigHash(): string {
  const path = universeConfigPath();
  const raw = readFileSync(path);
  return createHash("sha256").update(raw).digest("hex");
}

let cachedEngine: Engine | undefined;

/** Drop the cached engine so the next call rebuilds from disk. */
export function clearEngineCache(): void {
  cachedEngine = undefined;
}

/** Re-read config from disk and rebuild the engine (also updates the cache). */
export function reloadEngine(): Engine {
  cachedEngine = createEngine(loadUniverseConfig());
  return cachedEngine;
}

/** Build (once) and return the engine backed by the on-disk configuration. */
export function getEngine(): Engine {
  if (!cachedEngine) {
    cachedEngine = createEngine(loadUniverseConfig());
  }
  return cachedEngine;
}
