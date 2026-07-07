import { describe, expect, it } from "vitest";

import { parseBaselinePathFromExplanation } from "./chimera-ui-utils";

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
