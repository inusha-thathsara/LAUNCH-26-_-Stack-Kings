import { apiErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { handleApiRoute } from "@/lib/api/route-handler";
import { validateRouteBody } from "@/lib/api/validate-route";
import { routeWithCopilot } from "@/lib/chimera/agent/copilot";
import { assertValidRoutingReport } from "@/lib/chimera/report-schema";
import { routeWithTrueCost } from "@/lib/chimera/router/true-cost-router";
import { captureApiError } from "@/lib/observability/sentry";
import { getEngine } from "@/lib/relic/server/universe";

export const runtime = "nodejs";

/**
 * Phase 3 — Co-Pilot routing endpoint.
 *
 * Natural language:
 *   { "request": "Send Hello world from Aegis to Caelum" }
 *
 * Structured True Cost routing:
 *   { "origin_id": "Aegis", "destination_id": "Caelum", "payload": "Hello world" }
 *
 * Returns the mandatory Council {@link Phase2RoutingReport} schema.
 */
export async function POST(request: Request) {
  return handleApiRoute("/api/route", "POST", async () => {
    const limited = enforceRateLimit(request);
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const validated = validateRouteBody(body);
    if (!validated.ok) {
      return Response.json(validated.body, { status: validated.status });
    }

    const { universe } = getEngine();

    try {
      let report;
      if (validated.data.mode === "nl") {
        report = await routeWithCopilot(validated.data.request);
      } else {
        const { origin_id, destination_id, payload } = validated.data;
        if (!universe.nodesById.has(origin_id)) {
          return apiErrorResponse(
            400,
            "VALIDATION_ERROR",
            `Unknown origin planet "${origin_id}".`,
          );
        }
        if (!universe.nodesById.has(destination_id)) {
          return apiErrorResponse(
            400,
            "VALIDATION_ERROR",
            `Unknown destination planet "${destination_id}".`,
          );
        }

        report = await routeWithTrueCost({ origin_id, destination_id, payload });
      }

      // Strict output validation — guard against Council schema disqualification.
      return Response.json(assertValidRoutingReport(report));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureApiError(error, { route: "/api/route" });

      if (message.includes("CHIMERA_TEAM_KEY")) {
        return apiErrorResponse(503, "CHIMERA_UNAVAILABLE", message);
      }
      if (
        message.includes("Could not confidently parse") ||
        message.includes("Routing request is empty")
      ) {
        return apiErrorResponse(400, "PARSER_ERROR", message);
      }
      if (
        message.includes("No deliverable") ||
        message.includes("Cannot reach") ||
        message.includes("exceeded maximum reroute")
      ) {
        return apiErrorResponse(422, "ROUTING_ERROR", message);
      }

      return apiErrorResponse(500, "ENGINE_ERROR", message);
    }
  });
}
