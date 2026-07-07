import { MAX_PAYLOAD_CHARS } from "./constants";
import type { ApiErrorBody } from "./errors";

export interface NlRouteRequest {
  mode: "nl";
  request: string;
}

export interface StructuredRouteRequest {
  mode: "structured";
  origin_id: string;
  destination_id: string;
  payload: string;
}

export type RouteRequest = NlRouteRequest | StructuredRouteRequest;

type ValidationFailure = { ok: false; status: number; body: ApiErrorBody };
type ValidationSuccess = { ok: true; data: RouteRequest };

/**
 * Validate and normalize a POST /api/route body.
 *
 * Accepts either:
 *   { "request": "Send hello from Aegis to Caelum" }
 * or:
 *   { "origin_id": "Aegis", "destination_id": "Caelum", "payload": "optional" }
 */
export function validateRouteBody(
  body: unknown,
): ValidationSuccess | ValidationFailure {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        error: "Request body must be a JSON object.",
      },
    };
  }

  const record = body as Record<string, unknown>;
  const request = record.request;

  if (typeof request === "string" && request.trim().length > 0) {
    if (request.length > MAX_PAYLOAD_CHARS) {
      return {
        ok: false,
        status: 413,
        body: {
          code: "PAYLOAD_TOO_LARGE",
          error: `request must not exceed ${MAX_PAYLOAD_CHARS} characters.`,
        },
      };
    }

    return { ok: true, data: { mode: "nl", request: request.trim() } };
  }

  const origin_id = record.origin_id;
  const destination_id = record.destination_id;
  const payload = record.payload;

  if (typeof origin_id !== "string" || typeof destination_id !== "string") {
    return {
      ok: false,
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        error:
          'Provide either { "request": "..." } for NL routing or { "origin_id": "...", "destination_id": "...", "payload": "..." } for structured routing.',
      },
    };
  }

  if (!origin_id.trim() || !destination_id.trim()) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        error: "origin_id and destination_id must be non-empty strings.",
      },
    };
  }

  if (origin_id.trim() === destination_id.trim()) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        error: "origin_id and destination_id must be different planets.",
      },
    };
  }

  const normalizedPayload = typeof payload === "string" ? payload : "";
  if (normalizedPayload.length > MAX_PAYLOAD_CHARS) {
    return {
      ok: false,
      status: 413,
      body: {
        code: "PAYLOAD_TOO_LARGE",
        error: `payload must not exceed ${MAX_PAYLOAD_CHARS} characters.`,
      },
    };
  }

  return {
    ok: true,
    data: {
      mode: "structured",
      origin_id: origin_id.trim(),
      destination_id: destination_id.trim(),
      payload: normalizedPayload,
    },
  };
}
