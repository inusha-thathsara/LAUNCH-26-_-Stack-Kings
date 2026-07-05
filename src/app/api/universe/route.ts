import { UNIVERSE_CACHE_MAX_AGE_SEC } from "@/lib/api/constants";
import { apiErrorResponse } from "@/lib/api/errors";
import { getEngine } from "@/lib/relic/server/universe";
import { RelicConfigError } from "@/lib/relic/config";

export const runtime = "nodejs";

/**
 * M1 - Universe Initialization. Returns the parsed metadata, planet nodes, and
 * the derived hop graph (which pairs are within Lmax).
 */
export function GET() {
  try {
    const { universe, graph } = getEngine();
    return Response.json(
      {
        metadata: universe.metadata,
        nodes: universe.nodes,
        adjacency: Object.fromEntries(graph.adjacency),
        edges: graph.edges,
      },
      {
        headers: {
          "Cache-Control": `public, max-age=${UNIVERSE_CACHE_MAX_AGE_SEC}, s-maxage=${UNIVERSE_CACHE_MAX_AGE_SEC}`,
        },
      },
    );
  } catch (error) {
    if (error instanceof RelicConfigError) {
      return apiErrorResponse(500, "ENGINE_ERROR", error.message);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiErrorResponse(500, "ENGINE_ERROR", message);
  }
}
