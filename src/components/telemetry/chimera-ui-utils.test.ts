import { describe, expect, it } from "vitest";

import {
  parseBaselinePathFromExplanation,
  previewParseIntent,
} from "./chimera-ui-utils";

const NODES = ["Aegis", "Boreas", "Caelum", "Dawn", "Fenix"];

describe("previewParseIntent", () => {
  it("parses origin, destination, and quoted payload from 'from/to' phrasing", () => {
    const intent = previewParseIntent('Send "ping" from Aegis to Caelum', NODES);
    expect(intent).toEqual({
      origin: "Aegis",
      destination: "Caelum",
      payload: "ping",
    });
  });

  it("parses arrow phrasing and 'send <msg> from' payload", () => {
    const intent = previewParseIntent("Send status ping from Boreas to Fenix", NODES);
    expect(intent.origin).toBe("Boreas");
    expect(intent.destination).toBe("Fenix");
    expect(intent.payload).toBe("status ping");
  });

  it("resolves node ids case-insensitively", () => {
    const intent = previewParseIntent("from aegis to caelum", NODES);
    expect(intent.origin).toBe("Aegis");
    expect(intent.destination).toBe("Caelum");
  });

  it("returns nulls for empty or unresolvable input", () => {
    expect(previewParseIntent("", NODES)).toEqual({
      origin: null,
      destination: null,
      payload: null,
    });
    const unknown = previewParseIntent("from Nowhere to Nothing", NODES);
    expect(unknown.origin).toBeNull();
    expect(unknown.destination).toBeNull();
  });
});

describe("parseBaselinePathFromExplanation", () => {
  it("extracts planet ids from Co-Pilot explanation", () => {
    const path = parseBaselinePathFromExplanation(
      'Co-Pilot routed "Hello" from Aegis to Caelum via Aegis → Boreas → Caelum. Baseline physics path was Aegis → Dawn → Caelum. No reroutes.',
    );
    expect(path).toEqual(["Aegis", "Dawn", "Caelum"]);
  });

  it("returns null when baseline is not mentioned", () => {
    expect(
      parseBaselinePathFromExplanation(
        "True Cost routed Boreas → Fenix with no overrides.",
      ),
    ).toBeNull();
  });
});
