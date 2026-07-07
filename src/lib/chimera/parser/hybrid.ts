/**
 * Hybrid natural-language parser stub.
 *
 * Owner: Inusha (Phase 2 — section 2.5)
 *
 * Parses free-form text routing requests into a structured intent before any
 * routing begins (per challenge requirement §4.1).
 *
 * Two-layer approach:
 *  Rules layer (fast path):
 *   - Regex for "from X to Y" / "X -> Y" / planet names from universe node list
 *   - Quoted payload extraction: "message" or payload: ...
 *   - Fuzzy match planet names (Levenshtein) against config nodes
 *
 *  LLM fallback (when rules confidence < threshold):
 *   - Vercel AI SDK generateObject with Zod schema
 *   - Schema: { origin_id, destination_id, payload, confidence }
 */

export interface StructuredIntent {
  origin_id: string;
  destination_id: string;
  payload: string;
  /** 0–1 confidence from the parser layer that produced this result. */
  confidence: number;
  /** Which layer produced the result. */
  source: "rules" | "llm";
}

/**
 * Parse a natural-language routing request into a structured intent.
 *
 * @param text      - Free-form user input, e.g. "Send hello from Aegis to Caelum"
 * @param nodeIds   - Valid planet IDs from the loaded universe config (for fuzzy matching)
 * @returns Structured routing intent
 * @throws when neither layer can extract origin and destination
 */
// TODO (Inusha — Phase 2): implement rules layer + LLM fallback
export async function parseRoutingRequest(
  _text: string,
  _nodeIds: string[],
): Promise<StructuredIntent> {
  throw new Error("parseRoutingRequest() not yet implemented — Phase 2 task.");
}
