import { transmit } from "@/lib/relic/transmission";
import type { RouteOptions } from "@/lib/relic/router";
import { getEngine } from "@/lib/relic/server/universe";

export const runtime = "nodejs";

interface TransmitBody {
  origin?: unknown;
  destination?: unknown;
  payload?: unknown;
  blockedNodes?: unknown;
  blockedEdges?: unknown;
}

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
 * M2/M3/M4 - Transmit a payload from origin to destination, optionally with
 * failed nodes/links, returning the packet (with hop_log), the route, the
 * latency breakdown, and the reconstructed payload.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TransmitBody;
    const origin = body.origin;
    const destination = body.destination;
    const payload = body.payload;

    if (
      typeof origin !== "string" ||
      typeof destination !== "string" ||
      typeof payload !== "string"
    ) {
      return Response.json(
        { error: "origin, destination, and payload are required strings." },
        { status: 400 },
      );
    }

    const options: RouteOptions = {
      blockedNodes: asStringArray(body.blockedNodes),
      blockedEdges: asEdgeList(body.blockedEdges),
    };

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
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
