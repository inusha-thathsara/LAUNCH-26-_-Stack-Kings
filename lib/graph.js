import { getConstants, voidDistanceKm, voidTravelTimeSeconds } from "./latency";

export function buildGraph(config, chaosState) {
  const constants = getConstants(config);
  const nodes = config.nodes;
  const graph = {};

  for (const node of nodes) {
    if (!chaosState.deadNodes.includes(node.id)) {
      graph[node.id] = [];
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      if (chaosState.deadNodes.includes(a.id)) continue;
      if (chaosState.deadNodes.includes(b.id)) continue;

      const linkKey1 = `${a.id}-${b.id}`;
      const linkKey2 = `${b.id}-${a.id}`;

      if (
        chaosState.deadLinks.includes(linkKey1) ||
        chaosState.deadLinks.includes(linkKey2)
      ) {
        continue;
      }

      const L = voidDistanceKm(a, b, constants);

      if (L <= constants.LMAX) {
        const tv = voidTravelTimeSeconds(a, b, constants);

        graph[a.id].push({
          to: b.id,
          weight: tv.voidTimeSeconds,
          distanceKm: L,
        });

        graph[b.id].push({
          to: a.id,
          weight: tv.voidTimeSeconds,
          distanceKm: L,
        });
      }
    }
  }

  return graph;
}