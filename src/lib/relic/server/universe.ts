/**
 * Node-only helpers for loading the universe configuration from disk and
 * providing a cached engine instance to server code (API routes, CLI).
 *
 * This module uses the filesystem and must never be imported by client
 * components.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createEngine, type Engine } from "../engine";

/** Absolute path to the universe configuration at the repository root. */
export function universeConfigPath(): string {
  return join(process.cwd(), "universe-config.json");
}

/** Read and parse the raw universe configuration JSON from disk. */
export function loadUniverseConfig(): unknown {
  return JSON.parse(readFileSync(universeConfigPath(), "utf8"));
}

let cachedEngine: Engine | undefined;

/** Build (once) and return the engine backed by the on-disk configuration. */
export function getEngine(): Engine {
  if (!cachedEngine) {
    cachedEngine = createEngine(loadUniverseConfig());
  }
  return cachedEngine;
}
