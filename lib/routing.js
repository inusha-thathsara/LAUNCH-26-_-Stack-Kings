export function dijkstra(graph, start, end) {
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  for (const node of unvisited) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[start] = 0;

  while (unvisited.size > 0) {
    let current = null;

    for (const node of unvisited) {
      if (current === null || distances[node] < distances[current]) {
        current = node;
      }
    }

    if (current === null) break;
    if (distances[current] === Infinity) break;
    if (current === end) break;

    unvisited.delete(current);

    for (const edge of graph[current]) {
      if (!unvisited.has(edge.to)) continue;

      const newDistance = distances[current] + edge.weight;

      if (newDistance < distances[edge.to]) {
        distances[edge.to] = newDistance;
        previous[edge.to] = current;
      }
    }
  }

  if (distances[end] === Infinity) {
    return {
      deliverable: false,
      path: [],
      estimatedLatencySeconds: null,
    };
  }

  const path = [];
  let current = end;

  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    deliverable: true,
    path,
    estimatedLatencySeconds: distances[end],
  };
}