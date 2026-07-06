import { describe, expect, it } from "vitest";

import { canonicalLinkId } from "./link-id";

describe("canonicalLinkId", () => {
  it("sorts alphabetically — lower id first", () => {
    expect(canonicalLinkId("Boreas", "Aegis")).toBe("Aegis-Boreas");
  });

  it("is idempotent — same result regardless of argument order", () => {
    expect(canonicalLinkId("Aegis", "Boreas")).toBe(canonicalLinkId("Boreas", "Aegis"));
  });

  it("returns the id unchanged when already in order", () => {
    expect(canonicalLinkId("Aegis", "Caelum")).toBe("Aegis-Caelum");
  });

  it("works with all planet pairs in the universe config", () => {
    const planets = ["Aegis", "Boreas", "Caelum", "Dawn", "Elysium", "Fenix"];
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const a = planets[i]!;
        const b = planets[j]!;
        const forward = canonicalLinkId(a, b);
        const reverse = canonicalLinkId(b, a);
        expect(forward).toBe(reverse);
        // Confirm format is "Smaller-Larger"
        const [first, second] = forward.split("-");
        expect(first! < second!).toBe(true);
      }
    }
  });
});
