import config from "../data/universe-config.json";
import { buildGraph } from "./graph";
import { dijkstra } from "./routing";
import {
  encodeMessageToCodex,
  decodeCodexToMessage,
  toBinaryStream,
} from "./codex";
import {
  getConstants,
  voidTravelTimeSeconds,
  towerIndexTowardPlanet,
  internalPlanetTimeSeconds,
} from "./latency";
import { chaosState } from "./chaosStore";

function findNode(id) {
  return config.nodes.find((node) => node.id === id);
}

export function getUniverse() {
  const graph = buildGraph(config, chaosState);

  return {
    metadata: config.universe_metadata,
    nodes: config.nodes,
    graph,
    chaos: chaosState,
  };
}

export function sendPacket(originId, destinationId, payload) {
  const graph = buildGraph(config, chaosState);
  const routeResult = dijkstra(graph, originId, destinationId);

  if (!routeResult.deliverable) {
    return {
      deliverable: false,
      reason: "No valid route found. Destination is unreachable under current Lmax/failure conditions.",
      packet: {
        origin_id: originId,
        destination_id: destinationId,
        current_id: originId,
        payload,
        hop_log: [],
      },
    };
  }

  const constants = getConstants(config);
  const path = routeResult.path;

  const hopLog = [];
  const latencyBreakdown = {
    totalFiberSeconds: 0,
    totalTowerSeconds: 0,
    totalAtmosphereDistanceKm: 0,
    totalVoidDistanceKm: 0,
    totalVoidSeconds: 0,
    totalInternalSeconds: 0,
    totalLatencySeconds: 0,
  };

  for (let i = 0; i < path.length; i++) {
    const current = findNode(path[i]);
    const previous = i > 0 ? findNode(path[i - 1]) : null;
    const next = i < path.length - 1 ? findNode(path[i + 1]) : null;

    let entryTower = 0;
    let exitTower = 0;

    if (previous) {
      entryTower = towerIndexTowardPlanet(current, previous);
    }

    if (next) {
      exitTower = towerIndexTowardPlanet(current, next);
    } else {
      exitTower = entryTower;
    }

    const internal = internalPlanetTimeSeconds(
      current,
      entryTower,
      exitTower,
      constants
    );

    latencyBreakdown.totalFiberSeconds += internal.fiberTimeSeconds;
    latencyBreakdown.totalTowerSeconds += internal.towerDelaySeconds;
    latencyBreakdown.totalInternalSeconds += internal.internalTimeSeconds;

    const nextCodex = next ? next.codex : current.codex;

    const encodedForNextHop = encodeMessageToCodex(payload, nextCodex);
    const binaryStream = toBinaryStream(encodedForNextHop);
    const decodedAtCurrent = decodeCodexToMessage(
      encodeMessageToCodex(payload, current.codex),
      current.codex
    );

    const hopEntry = {
      planet: current.id,
      planet_codex: current.codex,
      entry_tower: entryTower,
      exit_tower: exitTower,
      internal_latency: internal,
      decoded_ascii_inside_planet: decodedAtCurrent,
      next_hop: next ? next.id : null,
      next_hop_codex: nextCodex,
      encoded_payload_for_next_hop: encodedForNextHop,
      binary_stream_preview: binaryStream.slice(0, 96) + "...",
      status: next ? "FORWARDED" : "DELIVERED",
    };

    if (next) {
      const voidInfo = voidTravelTimeSeconds(current, next, constants);

      latencyBreakdown.totalAtmosphereDistanceKm +=
        voidInfo.atmosphereDistanceKm;
      latencyBreakdown.totalVoidDistanceKm += voidInfo.voidDistanceKm;
      latencyBreakdown.totalVoidSeconds += voidInfo.voidTimeSeconds;

      hopEntry.void_to_next = {
        from: current.id,
        to: next.id,
        void_distance_km: voidInfo.voidDistanceKm,
        atmosphere_distance_km: voidInfo.atmosphereDistanceKm,
        void_time_seconds: voidInfo.voidTimeSeconds,
      };
    }

    hopLog.push(hopEntry);
  }

  latencyBreakdown.totalLatencySeconds =
    latencyBreakdown.totalInternalSeconds + latencyBreakdown.totalVoidSeconds;

  return {
    deliverable: true,
    packet: {
      origin_id: originId,
      destination_id: destinationId,
      current_id: destinationId,
      payload,
      route: path,
      hop_log: hopLog,
    },
    latency_breakdown: latencyBreakdown,
  };
}