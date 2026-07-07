import { describe, expect, it, vi } from "vitest";

import { parseRoutingRequest } from "./hybrid";
import type { LlmParseFn } from "./llm";

const PLANETS = ["Aegis", "Boreas", "Caelum", "Dawn", "Elysium", "Fenix"];

describe("parseRoutingRequest — rules layer", () => {
  const cases: Array<{
    name: string;
    input: string;
    origin: string;
    destination: string;
    payload?: string;
  }> = [
    {
      name: "send + quoted payload + from/to",
      input: 'Send "hello council" from Aegis to Caelum',
      origin: "Aegis",
      destination: "Caelum",
      payload: "hello council",
    },
    {
      name: "single-quoted payload",
      input: "Send 'status ok' from Boreas to Dawn",
      origin: "Boreas",
      destination: "Dawn",
      payload: "status ok",
    },
    {
      name: "arrow syntax",
      input: "Boreas -> Fenix",
      origin: "Boreas",
      destination: "Fenix",
    },
    {
      name: "unicode arrow",
      input: "Dawn → Elysium",
      origin: "Dawn",
      destination: "Elysium",
    },
    {
      name: "plain from/to no payload",
      input: "from Aegis to Fenix",
      origin: "Aegis",
      destination: "Fenix",
    },
    {
      name: "route verb",
      input: "route from Caelum to Boreas",
      origin: "Caelum",
      destination: "Boreas",
    },
    {
      name: "payload field syntax",
      input: "from Aegis to Dawn payload: emergency beacon",
      origin: "Aegis",
      destination: "Dawn",
      payload: "emergency beacon",
    },
    {
      name: "send message before from",
      input: "Send urgent update from Elysium to Caelum",
      origin: "Elysium",
      destination: "Caelum",
      payload: "urgent update",
    },
    {
      name: "case-insensitive planet names",
      input: "from aegis to caelum",
      origin: "Aegis",
      destination: "Caelum",
    },
    {
      name: "fuzzy typo in origin",
      input: "from Aegs to Caelum",
      origin: "Aegis",
      destination: "Caelum",
    },
    {
      name: "fuzzy typo in destination",
      input: "from Boreas to Caelm",
      origin: "Boreas",
      destination: "Caelum",
    },
    {
      name: "two planets mentioned in order",
      input: "I need Aegis data delivered to Fenix quickly",
      origin: "Aegis",
      destination: "Fenix",
    },
    {
      name: "extra whitespace",
      input: "   from   Dawn    to    Fenix   ",
      origin: "Dawn",
      destination: "Fenix",
    },
    {
      name: "arrow with surrounding text",
      input: "please relay Aegis -> Elysium now",
      origin: "Aegis",
      destination: "Elysium",
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const intent = await parseRoutingRequest(testCase.input, PLANETS, { llm: null });
      expect(intent.origin_id).toBe(testCase.origin);
      expect(intent.destination_id).toBe(testCase.destination);
      expect(intent.source).toBe("rules");
      if (testCase.payload !== undefined) {
        expect(intent.payload).toBe(testCase.payload);
      }
    });
  }

  it("gives high confidence for exact planet names", async () => {
    const intent = await parseRoutingRequest("from Aegis to Caelum", PLANETS, {
      llm: null,
    });
    expect(intent.confidence).toBeGreaterThan(0.9);
  });

  it("throws on empty input", async () => {
    await expect(parseRoutingRequest("   ", PLANETS, { llm: null })).rejects.toThrow(
      /empty/,
    );
  });

  it("throws when endpoints cannot be resolved (rules-only)", async () => {
    await expect(
      parseRoutingRequest("route somewhere unknown", PLANETS, { llm: null }),
    ).rejects.toThrow(/Could not confidently parse/);
  });

  it("throws when only one planet is present", async () => {
    await expect(
      parseRoutingRequest("send data to Caelum", PLANETS, { llm: null }),
    ).rejects.toThrow(/Could not confidently parse/);
  });
});

describe("parseRoutingRequest — LLM fallback", () => {
  it("uses the injected LLM when rules fail", async () => {
    const llm: LlmParseFn = vi.fn().mockResolvedValue({
      origin_id: "Aegis",
      destination_id: "Fenix",
      payload: "good luck",
      confidence: 0.9,
    });

    const intent = await parseRoutingRequest(
      "shoot a note over to the fire world starting at the shield",
      PLANETS,
      { llm },
    );

    expect(intent.source).toBe("llm");
    expect(intent.origin_id).toBe("Aegis");
    expect(intent.destination_id).toBe("Fenix");
    expect(intent.payload).toBe("good luck");
    expect(llm).toHaveBeenCalledOnce();
  });

  it("does not call the LLM when rules succeed", async () => {
    const llm: LlmParseFn = vi.fn();
    await parseRoutingRequest("from Aegis to Caelum", PLANETS, { llm });
    expect(llm).not.toHaveBeenCalled();
  });

  it("throws when the LLM returns low confidence", async () => {
    const llm: LlmParseFn = vi.fn().mockResolvedValue({
      origin_id: "Aegis",
      destination_id: "Fenix",
      payload: "",
      confidence: 0.2,
    });

    await expect(
      parseRoutingRequest("mumble mumble planets", PLANETS, { llm }),
    ).rejects.toThrow(/Could not confidently parse/);
  });

  it("falls back to the rules error when the LLM is unreachable", async () => {
    const llm: LlmParseFn = vi.fn().mockRejectedValue(new Error("connection refused"));
    await expect(
      parseRoutingRequest("unparseable request", PLANETS, { llm }),
    ).rejects.toThrow(/Could not confidently parse/);
  });
});
