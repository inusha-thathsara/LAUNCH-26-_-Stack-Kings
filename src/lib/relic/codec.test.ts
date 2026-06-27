import { describe, expect, it } from "vitest";

import { createRelicCodec, RelicCodec } from "./codec";

describe("RelicCodec", () => {
  const codec = createRelicCodec();

  it("round-trips ASCII conversion", () => {
    const bytes = codec.toAscii("Hello world");
    expect(bytes).toEqual([72, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]);
    expect(codec.fromAscii(bytes)).toBe("Hello world");
  });

  it("matches the challenge base-5 encoding example", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 5);
    expect(encoded.digits).toEqual([
      "242",
      "401",
      "413",
      "413",
      "421",
      "112",
      "434",
      "421",
      "424",
      "413",
      "400",
    ]);
  });

  it("matches the challenge base-14 encoding example", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 14);
    expect(encoded.digits).toEqual([
      "52",
      "73",
      "7A",
      "7A",
      "7D",
      "24",
      "87",
      "7D",
      "82",
      "7A",
      "72",
    ]);
  });

  it("round-trips codex encode/decode", () => {
    const bytes = codec.toAscii("Hello world");
    const encoded = codec.encodeToCodex(bytes, 8);
    expect(codec.decodeFromCodex(encoded)).toEqual(bytes);
  });

  it("serializes the codex digits (not raw ASCII) into the binary stream", () => {
    // Base 14 of "Hi": H=72 -> "52", i=105 -> "77" -> representation "52 77".
    const encoded = codec.encodeToCodex(codec.toAscii("Hi"), 14);
    expect(encoded.digits).toEqual(["52", "77"]);
    const representation = "52 77";
    const expected = [...representation]
      .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, "0"))
      .join("");
    expect(codec.serializeToBinary(encoded)).toBe(expected);
  });

  it("round-trips binary serialization across several bases", () => {
    for (const base of [2, 5, 8, 14, 16, 36]) {
      const encoded = codec.encodeToCodex(codec.toAscii("Hello world"), base);
      const stream = codec.serializeToBinary(encoded);
      const restored = codec.deserializeFromBinary(stream, base);
      expect(restored.digits).toEqual(encoded.digits);
      expect(codec.fromAscii(codec.decodeFromCodex(restored))).toBe(
        "Hello world",
      );
    }
  });

  it("handles an empty payload", () => {
    const encoded = codec.encodeToCodex([], 5);
    expect(encoded.digits).toEqual([]);
    const stream = codec.serializeToBinary(encoded);
    expect(stream).toBe("");
    expect(codec.deserializeFromBinary(stream, 5).digits).toEqual([]);
  });

  it("rejects an unsupported base", () => {
    expect(() => codec.encodeToCodex([72], 1)).toThrow();
    expect(() => codec.encodeToCodex([72], 37)).toThrow();
    expect(() => codec.encodeToCodex([72], 2.5)).toThrow();
  });

  it("rejects a malformed binary stream", () => {
    expect(() => codec.deserializeFromBinary("0101", 5)).toThrow(
      /multiple of 8/,
    );
  });

  it("rejects a stream that decodes to an illegal digit for the base", () => {
    // Char '9' (base 5 illegal) serialized as a single 8-bit group.
    const stream = "9".charCodeAt(0).toString(2).padStart(8, "0");
    expect(() => codec.deserializeFromBinary(stream, 5)).toThrow(/not valid/);
  });

  it("is constructible directly", () => {
    expect(new RelicCodec()).toBeInstanceOf(RelicCodec);
  });
});
