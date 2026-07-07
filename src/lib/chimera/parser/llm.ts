/**
 * LLM fallback for the hybrid NL parser.
 *
 * Used only when the deterministic rules layer cannot confidently extract an
 * origin/destination. Two providers are supported and selected via env:
 *
 *   CHIMERA_LLM_PROVIDER=ollama   → local Ollama (no API key; default host)
 *   CHIMERA_LLM_PROVIDER=gemini   → Google Gemini REST API (needs GEMINI_API_KEY)
 *
 * When unset (or "off"), no LLM fallback is attempted and the parser relies on
 * the rules layer alone. This keeps CI deterministic and offline.
 *
 * Server-side only — never import from client components.
 */

import type { StructuredIntent } from "./hybrid";

/** A pluggable LLM parse function. Returns null when it cannot parse. */
export type LlmParseFn = (
  text: string,
  nodeIds: string[],
) => Promise<Omit<StructuredIntent, "source"> | null>;

interface RawLlmIntent {
  origin_id?: unknown;
  destination_id?: unknown;
  payload?: unknown;
  confidence?: unknown;
}

function buildPrompt(text: string, nodeIds: string[]): string {
  return [
    "You extract interplanetary routing intent from a user's message.",
    `Valid planet IDs (use these EXACT strings): ${nodeIds.join(", ")}.`,
    "Return ONLY a JSON object with keys:",
    '  "origin_id"      - the planet the message starts from (one of the valid IDs)',
    '  "destination_id" - the planet the message is sent to (one of the valid IDs)',
    '  "payload"        - the message content to transmit (empty string if none)',
    '  "confidence"     - your confidence 0..1 that origin and destination are correct',
    "If you cannot identify both planets, set confidence to 0.",
    `User message: ${JSON.stringify(text)}`,
  ].join("\n");
}

function normalizeIntent(
  raw: RawLlmIntent,
  nodeIds: string[],
): Omit<StructuredIntent, "source"> | null {
  const matchId = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    return nodeIds.find((id) => id.toLowerCase() === value.trim().toLowerCase());
  };

  const origin = matchId(raw.origin_id);
  const destination = matchId(raw.destination_id);
  if (!origin || !destination || origin === destination) return null;

  const payload = typeof raw.payload === "string" ? raw.payload.trim() : "";
  const rawConfidence = typeof raw.confidence === "number" ? raw.confidence : 0.7;
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  return { origin_id: origin, destination_id: destination, payload, confidence };
}

/** Create an Ollama-backed parser (local, no API key). */
export function createOllamaParser(
  options: {
    baseUrl?: string;
    model?: string;
    fetchFn?: typeof fetch;
  } = {},
): LlmParseFn {
  const baseUrl = (
    options.baseUrl ??
    process.env.OLLAMA_BASE_URL ??
    "http://localhost:11434"
  ).replace(/\/$/, "");
  const model = options.model ?? process.env.CHIMERA_LLM_MODEL ?? "qwen3:4b";
  const fetchFn = options.fetchFn ?? fetch;

  return async (text, nodeIds) => {
    const response = await fetchFn(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        format: "json",
        messages: [{ role: "user", content: buildPrompt(text, nodeIds) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama chat failed with HTTP ${response.status}.`);
    }

    const body = (await response.json()) as { message?: { content?: string } };
    const content = body.message?.content;
    if (!content) return null;

    let raw: RawLlmIntent;
    try {
      raw = JSON.parse(content) as RawLlmIntent;
    } catch {
      return null;
    }
    return normalizeIntent(raw, nodeIds);
  };
}

/** Create a Google Gemini-backed parser (needs GEMINI_API_KEY). */
export function createGeminiParser(
  options: {
    apiKey?: string;
    model?: string;
    fetchFn?: typeof fetch;
  } = {},
): LlmParseFn {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
  const model = options.model ?? process.env.CHIMERA_LLM_MODEL ?? "gemini-2.0-flash";
  const fetchFn = options.fetchFn ?? fetch;

  return async (text, nodeIds) => {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for the Gemini NL parser.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text, nodeIds) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini generateContent failed with HTTP ${response.status}.`);
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    let raw: RawLlmIntent;
    try {
      raw = JSON.parse(content) as RawLlmIntent;
    } catch {
      return null;
    }
    return normalizeIntent(raw, nodeIds);
  };
}

/**
 * Resolve the configured LLM fallback from environment, or undefined when the
 * fallback is disabled (default). Selected via `CHIMERA_LLM_PROVIDER`.
 */
export function resolveConfiguredLlm(): LlmParseFn | undefined {
  const provider = (process.env.CHIMERA_LLM_PROVIDER ?? "off").toLowerCase();
  if (provider === "ollama") return createOllamaParser();
  if (provider === "gemini") return createGeminiParser();
  return undefined;
}
