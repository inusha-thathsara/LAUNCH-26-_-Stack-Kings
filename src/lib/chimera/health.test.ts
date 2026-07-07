import { describe, expect, it } from "vitest";

import { areModelsLoaded } from "./health";

describe("Chimera health probes", () => {
  it("reports models as loaded when runtime JSON artifacts are present", () => {
    expect(areModelsLoaded()).toBe(true);
  });
});
