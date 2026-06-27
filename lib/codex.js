const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function toBase(num, base) {
  if (base < 2 || base > DIGITS.length) {
    throw new Error(`Unsupported base: ${base}`);
  }

  if (num === 0) return "0";

  let result = "";
  let value = num;

  while (value > 0) {
    result = DIGITS[value % base] + result;
    value = Math.floor(value / base);
  }

  return result;
}

export function fromBase(value, base) {
  return parseInt(value, base);
}

export function encodeMessageToCodex(message, base) {
  return [...message].map((char) => {
    const ascii = char.charCodeAt(0);
    return toBase(ascii, base);
  });
}

export function decodeCodexToMessage(values, base) {
  return values
    .map((value) => String.fromCharCode(fromBase(value, base)))
    .join("");
}

export function toBinaryStream(codexValues) {
  return codexValues
    .join(" ")
    .split("")
    .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}