/**
 * STUB — Encoding/Decoding teammate module.
 *
 * A functional placeholder codec so the transmission pipeline runs end-to-end
 * before the encoding teammate's implementation is merged. Digit casing is
 * uppercase to match the challenge example (e.g. base 14: ASCII 72 -> "52",
 * and A = 10). Replace the export wiring when their real module lands.
 */

import type { Codec, EncodedPayload } from "../contracts";

export class StubCodec implements Codec {
  toAscii(payload: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < payload.length; i += 1) {
      bytes.push(payload.charCodeAt(i));
    }
    return bytes;
  }

  fromAscii(bytes: number[]): string {
    return bytes.map((byte) => String.fromCharCode(byte)).join("");
  }

  encodeToCodex(asciiBytes: number[], base: number): EncodedPayload {
    this.assertBase(base);
    return {
      base,
      digits: asciiBytes.map((byte) => byte.toString(base).toUpperCase()),
    };
  }

  decodeFromCodex(encoded: EncodedPayload): number[] {
    this.assertBase(encoded.base);
    return encoded.digits.map((digit) => {
      const value = parseInt(digit, encoded.base);
      if (Number.isNaN(value)) {
        throw new Error(
          `StubCodec: digit "${digit}" is not valid in base ${encoded.base}.`,
        );
      }
      return value;
    });
  }

  serializeToBinary(encoded: EncodedPayload): string {
    // Reversible placeholder: emit each character's ASCII value as one byte,
    // length-tagged with the base so deserialization can reconstruct digits.
    const bytes = this.decodeFromCodex(encoded);
    return bytes
      .map((byte) => byte.toString(2).padStart(8, "0"))
      .join("");
  }

  deserializeFromBinary(stream: string, base: number): EncodedPayload {
    this.assertBase(base);
    if (stream.length % 8 !== 0) {
      throw new Error(
        "StubCodec: binary stream length must be a multiple of 8 bits.",
      );
    }
    const bytes: number[] = [];
    for (let i = 0; i < stream.length; i += 8) {
      bytes.push(parseInt(stream.slice(i, i + 8), 2));
    }
    return this.encodeToCodex(bytes, base);
  }

  private assertBase(base: number): void {
    if (!Number.isInteger(base) || base < 2 || base > 36) {
      throw new Error(
        `StubCodec: base must be an integer in [2, 36], received ${base}.`,
      );
    }
  }
}

/** Build a stub codec instance. */
export function createStubCodec(): Codec {
  return new StubCodec();
}
