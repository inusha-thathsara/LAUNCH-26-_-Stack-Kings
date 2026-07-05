/**
 * Packet transmission orchestration for the Relic Ring Protocol.
 *
 * Ties together routing (yours), geometry (mapping teammate), and the codec
 * (encoding teammate) into the full transmission flow:
 *
 *   Raw payload -> next-hop codex -> binary stream -> void -> destination codex
 *   -> local decoding (back to ASCII for internal tower routing).
 *
 * Each planet receives data already encoded in its own codex (the previous
 * planet encodes into the next hop's dialect before transmitting), so the
 * hop_log records every planet's payload in its own dialect, proving the
 * sequence of conversions along the route.
 */

import type { Codec, GeometryProvider } from "./contracts";
import { findShortestRoute, type Route, type RouteOptions } from "./router";
import type { HopLogEntry, Packet, Universe } from "./types";

/** Full outcome of a transmission attempt. */
export interface TransmissionResult {
  /** The packet in its mandatory schema, with a populated hop_log. */
  packet: Packet;
  /** The computed route (deliverable flag, latency breakdown, etc.). */
  route: Route;
  /**
   * The payload as reconstructed at the destination after the simulated
   * encode/serialize/deserialize/decode pipeline. Equals the original payload
   * on success; null when undeliverable.
   */
  delivered_payload: string | null;
}

/**
 * Simulate sending `payload` from origin to destination across the network.
 *
 * @throws {Error} when origin or destination id does not exist in the universe.
 */
export function transmit(
  universe: Universe,
  geometry: GeometryProvider,
  codec: Codec,
  originId: string,
  destinationId: string,
  payload: string,
  options: RouteOptions = {},
): TransmissionResult {
  const route = findShortestRoute(
    universe,
    geometry,
    originId,
    destinationId,
    options,
  );

  if (!route.deliverable) {
    return {
      packet: {
        origin_id: originId,
        destination_id: destinationId,
        current_id: originId,
        payload,
        hop_log: [],
        status: "undeliverable",
        undeliverable_reason: route.reason,
      },
      route,
      delivered_payload: null,
    };
  }

  // Walk the void hops, actually running the codec pipeline so the result is a
  // genuine proof of integrity rather than an assumption. The internal ASCII at
  // each planet is captured for the hop_log, along with the next-hop encoding
  // (codex digits and the binary stream) that actually crosses the void.
  const asciiByPlanet: number[][] = [codec.toAscii(payload)];
  const outgoingByPlanet: Array<{
    base: number;
    digits: string[];
    stream: string;
  } | null> = [];
  for (let i = 0; i < route.hops.length; i += 1) {
    const nextCodex = universe.nodesById.get(route.path[i + 1])!.codex;
    const incomingAscii = asciiByPlanet[i];

    const encoded = codec.encodeToCodex(incomingAscii, nextCodex);
    const stream = codec.serializeToBinary(encoded);
    const received = codec.deserializeFromBinary(stream, nextCodex);
    const decodedAscii = codec.decodeFromCodex(received);

    outgoingByPlanet.push({ base: nextCodex, digits: encoded.digits, stream });
    asciiByPlanet.push(decodedAscii);
  }

  const deliveredAscii = asciiByPlanet[asciiByPlanet.length - 1];
  const deliveredPayload = codec.fromAscii(deliveredAscii);

  const hop_log: HopLogEntry[] = [];
  let cumulative = 0;
  for (let i = 0; i < route.steps.length; i += 1) {
    const step = route.steps[i];
    const planet = universe.nodesById.get(step.planet_id)!;
    const planetAscii = asciiByPlanet[i];
    const dialect = codec.encodeToCodex(planetAscii, planet.codex);

    cumulative += step.internal.total_ms;
    const hop = i < route.hops.length ? route.hops[i] : undefined;
    let voidLatencyMs: number | undefined;
    if (hop) {
      voidLatencyMs = hop.void.total_ms;
      cumulative += voidLatencyMs;
    }

    const outgoing = i < outgoingByPlanet.length ? outgoingByPlanet[i] : null;

    hop_log.push({
      sequence: i,
      planet_id: step.planet_id,
      codex: planet.codex,
      entry_tower: step.entry_tower,
      exit_tower: step.exit_tower,
      towers_hit: step.internal.towers_hit,
      segments: step.internal.segments,
      payload_ascii: planetAscii,
      payload_dialect: { base: planet.codex, digits: dialect.digits },
      next_hop_codex: outgoing ? outgoing.base : undefined,
      next_hop_dialect: outgoing
        ? { base: outgoing.base, digits: outgoing.digits }
        : undefined,
      binary_stream: outgoing ? outgoing.stream : undefined,
      internal_latency_ms: step.internal.total_ms,
      void_latency_ms: voidLatencyMs,
      next_hop_id: hop ? hop.to : undefined,
      cumulative_latency_ms: cumulative,
    });
  }

  return {
    packet: {
      origin_id: originId,
      destination_id: destinationId,
      current_id: destinationId,
      payload,
      hop_log,
      status: "delivered",
    },
    route,
    delivered_payload: deliveredPayload,
  };
}
