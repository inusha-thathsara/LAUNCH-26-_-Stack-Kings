import { apiErrorResponse } from "@/lib/api/errors";
import { validateTransmitBody } from "@/lib/api/validate-transmit";
import { RelicConfigError } from "@/lib/relic/config";
import { getEngine } from "@/lib/relic/server/universe";
import { transmit } from "@/lib/relic/transmission";

export const runtime = "nodejs";

/**
 * M2/M3/M4 - Transmit a payload from origin to destination, optionally with
 * failed nodes/links, returning the packet (with hop_log), the route, the
 * latency breakdown, and the reconstructed payload.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiErrorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const validated = validateTransmitBody(body);
  if (!validated.ok) {
    return Response.json(validated.body, { status: validated.status });
  }

  const { origin, destination, payload, options } = validated.data;

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
    return Response.json(result);
  } catch (error) {
    if (error instanceof RelicConfigError) {
      return apiErrorResponse(500, "ENGINE_ERROR", error.message);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    // Unknown origin/destination ids are client errors; everything else is 500.
    if (message.startsWith("Unknown origin") || message.startsWith("Unknown destination")) {
      return apiErrorResponse(400, "VALIDATION_ERROR", message);
    }
    return apiErrorResponse(500, "ENGINE_ERROR", message);
  }
}
