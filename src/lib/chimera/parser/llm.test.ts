import { describe, expect, it, vi } from "vitest";

import { createGeminiParser, createOllamaParser } from "./llm";

const PLANETS = ["Aegis", "Boreas", "Caelum", "Dawn", "Elysium", "Fenix"];

describe("createOllamaParser", () => {
  it("parses a valid Ollama JSON response and matches planet IDs", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              origin_id: "aegis",
              destination_id: "CAELUM",
              payload: "hi",
              confidence: 0.88,
            }),
          },
        }),
        { status: 200 },
      ),
    );

    const parse = createOllamaParser({ fetchFn, baseUrl: "http://ollama.test" });
    const result = await parse("whatever", PLANETS);

    expect(result).toEqual({
      origin_id: "Aegis",
      destination_id: "Caelum",
      payload: "hi",
      confidence: 0.88,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://ollama.test/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns null when origin and destination collapse to the same planet", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              origin_id: "Aegis",
              destination_id: "Aegis",
              payload: "",
              confidence: 0.9,
            }),
          },
        }),
        { status: 200 },
      ),
    );

    const parse = createOllamaParser({ fetchFn });
    expect(await parse("x", PLANETS)).toBeNull();
  });

  it("returns null on non-JSON content", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "not json" } }), {
          status: 200,
        }),
      );
    const parse = createOllamaParser({ fetchFn });
    expect(await parse("x", PLANETS)).toBeNull();
  });

  it("throws on HTTP error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    const parse = createOllamaParser({ fetchFn });
    await expect(parse("x", PLANETS)).rejects.toThrow(/HTTP 500/);
  });
});

describe("createGeminiParser", () => {
  it("parses a valid Gemini response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      origin_id: "Boreas",
                      destination_id: "Dawn",
                      payload: "ping",
                      confidence: 0.95,
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const parse = createGeminiParser({ fetchFn, apiKey: "test-key" });
    const result = await parse("send ping", PLANETS);
    expect(result).toMatchObject({
      origin_id: "Boreas",
      destination_id: "Dawn",
      payload: "ping",
    });
  });

  it("throws when the API key is missing", async () => {
    const parse = createGeminiParser({ fetchFn: vi.fn(), apiKey: "" });
    await expect(parse("x", PLANETS)).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
