import { UNIVERSE_CACHE_MAX_AGE_SEC } from "@/lib/api/constants";
import { apiErrorResponse } from "@/lib/api/errors";
import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";
import { RelicConfigError } from "@/lib/relic/config";
import { getEngine } from "@/lib/relic/server/universe";

export const runtime = "nodejs";

/**
 * M1 - Universe Initialization. Returns the parsed metadata, planet nodes, and
 * the derived hop graph (which pairs are within Lmax).
 */
export async function GET() {
  return handleApiRoute("/api/universe", "GET", async () => {
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
      captureApiError(error, { route: "/api/universe" });
      if (error instanceof RelicConfigError) {
        return apiErrorResponse(500, "ENGINE_ERROR", error.message);
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      return apiErrorResponse(500, "ENGINE_ERROR", message);
    }
  });
}
