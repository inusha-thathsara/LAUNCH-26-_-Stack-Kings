import { getEngine } from "@/lib/relic/server/universe";

export const runtime = "nodejs";

/**
 * M1 - Universe Initialization. Returns the parsed metadata, planet nodes, and
 * the derived hop graph (which pairs are within Lmax).
 */
export function GET() {
  try {
    const { universe, graph } = getEngine();
    return Response.json({
      metadata: universe.metadata,
      nodes: universe.nodes,
      adjacency: Object.fromEntries(graph.adjacency),
      edges: graph.edges,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
