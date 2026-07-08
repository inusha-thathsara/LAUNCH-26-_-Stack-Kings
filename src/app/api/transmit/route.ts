import { apiErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { handleApiRoute } from "@/lib/api/route-handler";
import { validateTransmitBody } from "@/lib/api/validate-transmit";
import { routeWithTrueCost } from "@/lib/chimera/router/true-cost-router";
import { buildBlockedEdgesExceptPath } from "@/lib/chimera/routing-report";
import type { Phase2RoutingReport } from "@/lib/chimera/types";
import { captureApiError } from "@/lib/observability/sentry";
import { RelicConfigError } from "@/lib/relic/config";
import type { RouteOptions } from "@/lib/relic/router";
import { getEngine } from "@/lib/relic/server/universe";
import { transmit } from "@/lib/relic/transmission";

export const runtime = "nodejs";

/**
 * M2/M3/M4 - Transmit a payload from origin to destination, optionally with
 * failed nodes/links, returning the packet (with hop_log), the route, the
 * latency breakdown, and the reconstructed payload.
 *
 * Phase 2 (optional): when `use_copilot: true` is set, a Chimera True Cost
 * routing report is attached under `routing_report`, AND the packet is
 * transmitted along the Co-Pilot's `chosen_path` (constraining the physics
 * router to that intelligent route) so the hop_log proves delivery over the
 * Chimera-aware path. Falls back to the physics baseline if the constrained
 * transmission is undeliverable (e.g. a manually severed node on that path).
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
      let result = transmit(
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
      let transmitted_on_copilot_path = false;
      try {
        routing_report = await routeWithTrueCost({
          origin_id: origin,
          destination_id: destination,
          payload,
        });

        // Send the packet along the Co-Pilot's intelligent path by constraining
        // the physics router to only the edges on that path.
        if (routing_report.chosen_path.length >= 2) {
          const pathBlocked = buildBlockedEdgesExceptPath(
            universe,
            geometry,
            routing_report.chosen_path,
          );
          const constrainedOptions: RouteOptions = {
            blockedNodes: options.blockedNodes,
            blockedEdges: [
              ...(options.blockedEdges ? [...options.blockedEdges] : []),
              ...pathBlocked,
            ],
          };
          const copilotResult = transmit(
            universe,
            geometry,
            codec,
            origin,
            destination,
            payload,
            constrainedOptions,
          );
          if (copilotResult.route.deliverable) {
            result = copilotResult;
            transmitted_on_copilot_path = true;
          }
        }
      } catch (copilotError) {
        routing_report_error =
          copilotError instanceof Error
            ? copilotError.message
            : "Co-Pilot unavailable.";
      }

      return Response.json({
        ...result,
        routing_report,
        routing_report_error,
        transmitted_on_copilot_path,
      });
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
