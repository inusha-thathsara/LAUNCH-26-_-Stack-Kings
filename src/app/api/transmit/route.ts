import { apiErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { handleApiRoute } from "@/lib/api/route-handler";
import { validateTransmitBody } from "@/lib/api/validate-transmit";
import { routeWithTrueCost } from "@/lib/chimera/router/true-cost-router";
import type { Phase2RoutingReport } from "@/lib/chimera/types";
import { captureApiError } from "@/lib/observability/sentry";
import { RelicConfigError } from "@/lib/relic/config";
import { getEngine } from "@/lib/relic/server/universe";
import { transmit } from "@/lib/relic/transmission";

export const runtime = "nodejs";

/**
 * M2/M3/M4 - Transmit a payload from origin to destination, optionally with
 * failed nodes/links, returning the packet (with hop_log), the route, the
 * latency breakdown, and the reconstructed payload.
 *
 * Phase 2 (optional): when `use_copilot: true` is set, a Chimera True Cost
 * routing report is attached under `routing_report` alongside the Phase 1
 * result. The physics transmission itself is unchanged.
 */
export async function POST(request: Request) {
  return handleApiRoute("/api/transmit", "POST", async () => {
    const limited = enforceRateLimit(request);
    if (limited) return limited;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const validated = validateTransmitBody(body);
    if (!validated.ok) {
      return Response.json(validated.body, { status: validated.status });
    }

    const { origin, destination, payload, options, useCopilot } = validated.data;

    try {
      const { universe, geometry, codec } = getEngine();
      const result = transmit(
        universe,
        geometry,
        codec,
        origin,
        destination,
        payload,
        options,
      );

      if (!useCopilot) {
        return Response.json(result);
      }

      // Best-effort Co-Pilot overlay; never fails the core transmission.
      let routing_report: Phase2RoutingReport | null = null;
      let routing_report_error: string | null = null;
      try {
        routing_report = await routeWithTrueCost({
          origin_id: origin,
          destination_id: destination,
          payload,
        });
      } catch (copilotError) {
        routing_report_error =
          copilotError instanceof Error
            ? copilotError.message
            : "Co-Pilot unavailable.";
      }

      return Response.json({ ...result, routing_report, routing_report_error });
    } catch (error) {
      captureApiError(error, { route: "/api/transmit", origin, destination });
      if (error instanceof RelicConfigError) {
        return apiErrorResponse(500, "ENGINE_ERROR", error.message);
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      if (
        message.startsWith("Unknown origin") ||
        message.startsWith("Unknown destination")
      ) {
        return apiErrorResponse(400, "VALIDATION_ERROR", message);
      }
      return apiErrorResponse(500, "ENGINE_ERROR", message);
    }
  });
}
