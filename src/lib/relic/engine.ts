/**
 * Composition root for the Relic Ring Protocol engine.
 *
 * This is the single place where the engine is wired to its dependencies. The
 * mapping teammate's geometry module and the encoding teammate's codec module
 * are injected here behind their interfaces. To merge their real work, replace
 * only the two stub factories below — nothing else in the engine changes.
 */

import type { Codec, GeometryProvider } from "./contracts";
import { parseUniverseConfig } from "./config";
import { createRelicCodec } from "./codec";
import { buildNetworkGraph, type NetworkGraph } from "./graph";
import { ResilientNetwork } from "./resilience";
import { createStubGeometryProvider } from "./stubs/geometry.stub";
import type { Universe } from "./types";

/** A fully assembled engine ready for routing and transmission. */
export interface Engine {
  universe: Universe;
  geometry: GeometryProvider;
  codec: Codec;
  graph: NetworkGraph;
  /** Stateful, failure-aware controller for interactive use. */
  network: ResilientNetwork;
}

/**
 * Build an engine from a raw (unparsed) universe configuration object.
 *
 * @throws {RelicConfigError} when the configuration is invalid.
 */
export function createEngine(rawConfig: unknown): Engine {
  const universe = parseUniverseConfig(rawConfig);

  // ===== Teammate integration swap point =====
  // Geometry still uses the functional stub provider (a complete, correct
  // implementation); replace it with the mapping teammate's module if/when a
  // dedicated one lands. The codec is the production RelicCodec, which realizes
  // the codex -> binary serialization mandated by the protocol.
  const geometry: GeometryProvider = createStubGeometryProvider(
    universe.metadata,
  );
  const codec: Codec = createRelicCodec();
  // ============================================

  const graph = buildNetworkGraph(universe, geometry);
  const network = new ResilientNetwork(universe, geometry, codec);

  return { universe, geometry, codec, graph, network };
}
