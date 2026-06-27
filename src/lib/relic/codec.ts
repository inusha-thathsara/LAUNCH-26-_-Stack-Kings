/**
 * Production codec for the Relic Ring Protocol (encoding/decoding module).
 *
 * This replaces the placeholder in `./stubs/codec.stub.ts` at the engine
 * composition root. The per-character digit logic matches the challenge
 * examples (e.g. base 5: ASCII 72 -> "242"; base 14: ASCII 72 -> "52"), and
 * the binary serialization is a faithful realization of the mandated flow:
 *
 *   Raw payload -> next-hop codex digits -> flat binary stream -> void
 *   -> codex digits -> local decoding (ASCII).
 *
 * Serialization semantics (aligned with the encoding teammate's `toBinaryStream`
 * on `pasindu-dev`): the codex digit strings are joined with a single space
 * delimiter and every character of that representation is emitted as one 8-bit
 * group. Because codex digits only use [0-9A-Z], the space is an unambiguous
 * delimiter, which makes the stream fully reversible.
 */

import type { Codec, EncodedPayload } from "./contracts";

/** Delimiter separating per-character codex digits inside the binary stream. */
const DIGIT_DELIMITER = " ";

export class RelicCodec implements Codec {
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
    return encoded.digits.map((digit) => this.parseDigit(digit, encoded.base));
  }

  serializeToBinary(encoded: EncodedPayload): string {
    this.assertBase(encoded.base);
    // The codex representation itself (digit strings joined by a delimiter) is
    // what crosses the void, so the stream is a genuine function of the codex.
    const representation = encoded.digits.join(DIGIT_DELIMITER);
    let stream = "";
    for (let i = 0; i < representation.length; i += 1) {
      stream += representation.charCodeAt(i).toString(2).padStart(8, "0");
    }
    return stream;
  }

  deserializeFromBinary(stream: string, base: number): EncodedPayload {
    this.assertBase(base);
    if (stream.length === 0) {
      return { base, digits: [] };
    }
    if (stream.length % 8 !== 0) {
      throw new Error(
        "RelicCodec: binary stream length must be a multiple of 8 bits.",
      );
    }

    let representation = "";
    for (let i = 0; i < stream.length; i += 8) {
      representation += String.fromCharCode(parseInt(stream.slice(i, i + 8), 2));
    }

    const digits = representation.split(DIGIT_DELIMITER);
    // Validate that every reconstructed digit is legal in the target base.
    digits.forEach((digit) => this.parseDigit(digit, base));
    return { base, digits };
  }

  private parseDigit(digit: string, base: number): number {
    const value = parseInt(digit, base);
    if (Number.isNaN(value)) {
      throw new Error(
        `RelicCodec: digit "${digit}" is not valid in base ${base}.`,
      );
    }
    return value;
  }

  private assertBase(base: number): void {
    if (!Number.isInteger(base) || base < 2 || base > 36) {
      throw new Error(
        `RelicCodec: base must be an integer in [2, 36], received ${base}.`,
      );
    }
  }
}

/** Build a production codec instance. */
export function createRelicCodec(): Codec {
  return new RelicCodec();
}
