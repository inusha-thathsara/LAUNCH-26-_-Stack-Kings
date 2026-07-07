import { apiErrorResponse } from "@/lib/api/errors";
import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";
import { getEngine } from "@/lib/relic/server/universe";
import { routeWithCopilot } from "@/lib/chimera/agent/copilot";
import { routeWithTrueCost } from "@/lib/chimera/router/true-cost-router";

export const runtime = "nodejs";

/**
 * POST /api/route
 *
 * Routes a message using the Chimera Co-Pilot agent with True Cost scoring.
 * Returns the mandatory Council Phase2RoutingReport schema.
 *
 * Accepts two body formats:
 *
 * 1. Natural-language request:
 *    { "request": "Send Hello world from Aegis to Caelum" }
 *
 * 2. Structured (for testing / direct API use):
 *    { "origin_id": "Aegis", "destination_id": "Caelum", "payload": "Hello world" }
 */
export async function POST(request: Request) {
  return handleApiRoute("/api/route", "POST", async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiErrorResponse(
        400,
        "VALIDATION_ERROR",
        "Request body must be a JSON object.",
      );
    }

    const record = body as Record<string, unknown>;

    // Validate that the engine can load before routing
    try {
      getEngine();
    } catch (error) {
      captureApiError(error, { route: "/api/route" });
      return apiErrorResponse(500, "ENGINE_ERROR", "Universe engine failed to load.");
    }

    // Branch: NL request or structured
    try {
      if (typeof record.request === "string" && record.request.trim().length > 0) {
        // NL path — route through Co-Pilot (parser + true-cost router)
        const report = await routeWithCopilot(record.request.trim());
        return Response.json(report);
      }

      if (
        typeof record.origin_id === "string" &&
        typeof record.destination_id === "string"
      ) {
        // Structured path — skip NL parser, go straight to true-cost router
        const payload =
          typeof record.payload === "string" ? record.payload : "Hello";

        if (!record.origin_id.trim() || !record.destination_id.trim()) {
          return apiErrorResponse(
            400,
            "VALIDATION_ERROR",
            "origin_id and destination_id must be non-empty strings.",
          );
        }

        const report = await routeWithTrueCost({
          origin_id: record.origin_id.trim(),
          destination_id: record.destination_id.trim(),
          payload,
        });
        return Response.json(report);
      }

      return apiErrorResponse(
        400,
        "VALIDATION_ERROR",
        'Provide either { "request": "..." } for NL routing or { "origin_id": "...", "destination_id": "...", "payload": "..." } for structured routing.',
      );
    } catch (error) {
      captureApiError(error, { route: "/api/route" });
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message.includes("Unknown origin") ||
        message.includes("Unknown destination") ||
        message.includes("cannot extract origin") ||
        message.includes("unknown planet")
      ) {
        return apiErrorResponse(400, "VALIDATION_ERROR", message);
      }
      return apiErrorResponse(500, "ENGINE_ERROR", message);
    }
  });
}
