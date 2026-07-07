import type { RouteOptions } from "@/lib/relic/router";

import { MAX_BLOCKED_EDGES, MAX_BLOCKED_NODES, MAX_PAYLOAD_CHARS } from "./constants";
import type { ApiErrorBody } from "./errors";

export interface TransmitRequest {
  origin: string;
  destination: string;
  payload: string;
  options: RouteOptions;
  /** When true, attach a Phase 2 Co-Pilot routing report to the response. */
  useCopilot: boolean;
}

type ValidationFailure = { ok: false; status: number; body: ApiErrorBody };
type ValidationSuccess = { ok: true; data: TransmitRequest };

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asEdgeList(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) return [];
  const edges: Array<[string, string]> = [];
  for (const item of value) {
    if (
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "string" &&
      typeof item[1] === "string"
    ) {
      edges.push([item[0], item[1]]);
    }
  }
  return edges;
}

/**
 * Validate and normalize a POST /api/transmit body.
 * Returns a structured error with HTTP status when invalid.
 */
export function validateTransmitBody(
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
  const origin = record.origin;
  const destination = record.destination;
  const payload = record.payload;

  if (
    typeof origin !== "string" ||
    typeof destination !== "string" ||
    typeof payload !== "string"
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        error: "origin, destination, and payload are required strings.",
      },
    };
  }

  if (payload.length > MAX_PAYLOAD_CHARS) {
    return {
      ok: false,
      status: 413,
      body: {
        code: "PAYLOAD_TOO_LARGE",
        error: `payload must not exceed ${MAX_PAYLOAD_CHARS} characters.`,
      },
    };
  }

  const blockedNodes = asStringArray(record.blockedNodes);
  const blockedEdges = asEdgeList(record.blockedEdges);

  if (blockedNodes.length > MAX_BLOCKED_NODES) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "BLOCKED_LIST_TOO_LARGE",
        error: `blockedNodes must not exceed ${MAX_BLOCKED_NODES} entries.`,
      },
    };
  }

  if (blockedEdges.length > MAX_BLOCKED_EDGES) {
    return {
      ok: false,
      status: 400,
      body: {
        code: "BLOCKED_LIST_TOO_LARGE",
        error: `blockedEdges must not exceed ${MAX_BLOCKED_EDGES} entries.`,
      },
    };
  }

  return {
    ok: true,
    data: {
      origin,
      destination,
      payload,
      options: { blockedNodes, blockedEdges },
      useCopilot: record.use_copilot === true,
    },
  };
}
