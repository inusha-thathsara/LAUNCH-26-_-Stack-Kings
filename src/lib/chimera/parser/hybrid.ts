/**
 * Hybrid natural-language parser.
 *
 * Rules layer (fast path):
 *   - Regex for "from X to Y" / "X -> Y" / planet names from universe node list
 *   - Quoted payload extraction: "message" or payload: ...
 *   - Fuzzy match planet names (Levenshtein) against config nodes
 *
 * LLM fallback (optional):
 *   - When the rules layer can't confidently resolve both endpoints, and an LLM
 *     provider is configured (`CHIMERA_LLM_PROVIDER=ollama|gemini`) or injected
 *     via `options.llm`, the request is handed to the LLM for extraction.
 *   - Disabled by default so CI stays deterministic and offline.
 */

import { PARSER_CONFIDENCE_THRESHOLD } from "../constants";
import { resolveConfiguredLlm, type LlmParseFn } from "./llm";

export interface StructuredIntent {
  origin_id: string;
  destination_id: string;
  payload: string;
  /** 0–1 confidence from the parser layer that produced this result. */
  confidence: number;
  /** Which layer produced the result. */
  source: "rules" | "llm";
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i += 1) matrix[i]![0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}

function resolvePlanetName(
  raw: string,
  nodeIds: string[],
): { id: string; confidence: number } | undefined {
  const token = raw.trim();
  if (!token) return undefined;

  const exact = nodeIds.find((id) => id.toLowerCase() === token.toLowerCase());
  if (exact) return { id: exact, confidence: 0.98 };

  let best: { id: string; distance: number } | undefined;
  for (const id of nodeIds) {
    const distance = levenshtein(token.toLowerCase(), id.toLowerCase());
    const maxDistance = id.length <= 4 ? 1 : 2;
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { id, distance };
    }
  }
  if (!best) return undefined;

  const confidence = best.distance === 0 ? 0.98 : best.distance === 1 ? 0.82 : 0.68;
  return { id: best.id, confidence };
}

function extractPayload(text: string): string {
  const quoted = text.match(/["']([^"']+)["']/);
  if (quoted?.[1]) return quoted[1];

  const payloadField = text.match(/\bpayload\s*:\s*["']?([^"'\n]+)["']?/i);
  if (payloadField?.[1]) return payloadField[1].trim();

  const sendMatch = text.match(/^\s*send\s+(.+?)\s+from\s+/i);
  if (sendMatch?.[1]) return sendMatch[1].trim();

  return "";
}

function extractEndpoints(
  text: string,
  nodeIds: string[],
): {
  origin?: { id: string; confidence: number };
  destination?: { id: string; confidence: number };
} {
  const fromTo = text.match(/\bfrom\s+([A-Za-z][\w-]*)\s+to\s+([A-Za-z][\w-]*)/i);
  if (fromTo) {
    return {
      origin: resolvePlanetName(fromTo[1]!, nodeIds),
      destination: resolvePlanetName(fromTo[2]!, nodeIds),
    };
  }

  const arrow = text.match(/\b([A-Za-z][\w-]*)\s*(?:->|→)\s*([A-Za-z][\w-]*)/);
  if (arrow) {
    return {
      origin: resolvePlanetName(arrow[1]!, nodeIds),
      destination: resolvePlanetName(arrow[2]!, nodeIds),
    };
  }

  const mentioned = nodeIds
    .map((id) => {
      const pattern = new RegExp(`\\b${id}\\b`, "i");
      return pattern.test(text) ? id : undefined;
    })
    .filter((id): id is string => id !== undefined);

  if (mentioned.length >= 2) {
    const firstIndex = text.toLowerCase().indexOf(mentioned[0]!.toLowerCase());
    const secondIndex = text.toLowerCase().indexOf(mentioned[1]!.toLowerCase());
    const [originId, destinationId] =
      firstIndex <= secondIndex
        ? [mentioned[0]!, mentioned[1]!]
        : [mentioned[1]!, mentioned[0]!];
    return {
      origin: { id: originId, confidence: 0.75 },
      destination: { id: destinationId, confidence: 0.75 },
    };
  }

  return {};
}

/** Options for {@link parseRoutingRequest}. */
export interface ParseOptions {
  /**
   * LLM fallback used when the rules layer is not confident. When omitted, the
   * provider configured by `CHIMERA_LLM_PROVIDER` is used (if any). Pass `null`
   * to force rules-only parsing.
   */
  llm?: LlmParseFn | null;
}

function tryRules(text: string, nodeIds: string[]): StructuredIntent | undefined {
  const { origin, destination } = extractEndpoints(text, nodeIds);
  if (!origin || !destination || origin.id === destination.id) return undefined;

  const confidence = Math.min(origin.confidence, destination.confidence);
  if (confidence < PARSER_CONFIDENCE_THRESHOLD) return undefined;

  return {
    origin_id: origin.id,
    destination_id: destination.id,
    payload: extractPayload(text),
    confidence,
    source: "rules",
  };
}

/**
 * Parse a natural-language routing request into a structured intent.
 *
 * @param text      - Free-form user input, e.g. "Send hello from Aegis to Caelum"
 * @param nodeIds   - Valid planet IDs from the loaded universe config (for fuzzy matching)
 * @param options   - Optional LLM fallback override
 * @returns Structured routing intent
 * @throws when neither layer can extract origin and destination
 */
export async function parseRoutingRequest(
  text: string,
  nodeIds: string[],
  options: ParseOptions = {},
): Promise<StructuredIntent> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Routing request is empty.");
  }

  const rulesResult = tryRules(trimmed, nodeIds);
  if (rulesResult) return rulesResult;

  const llm = options.llm === undefined ? resolveConfiguredLlm() : options.llm;
  if (llm) {
    try {
      const llmResult = await llm(trimmed, nodeIds);
      if (llmResult && llmResult.confidence >= PARSER_CONFIDENCE_THRESHOLD) {
        return { ...llmResult, source: "llm" };
      }
    } catch {
      // Fall through to the shared error below when the LLM is unreachable.
    }
  }

  throw new Error(
    'Could not confidently parse origin and destination. Try "Send <message> from <planet> to <planet>".',
  );
}
