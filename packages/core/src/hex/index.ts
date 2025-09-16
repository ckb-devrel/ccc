import { bytesFrom, BytesLike, bytesTo } from "../bytes/index.js";

/**
 * Represents a hexadecimal string prefixed with "0x".
 * @public
 */
export type Hex = `0x${string}`;
/**
 * Represents a value that can be converted to a hexadecimal string.
 * It extends the BytesLike type.
 * @public
 */
export type HexLike = BytesLike;

/**
 * Determines whether a given value is a properly formatted hexadecimal string (ccc.Hex).
 *
 * A valid hexadecimal string:
 * - Has at least two characters.
 * - Starts with "0x".
 * - Has an even length.
 * - Contains only characters representing digits (0-9) or lowercase letters (a-f) after the "0x" prefix.
 *
 * @param v - The value to validate as a hexadecimal (ccc.Hex) string.
 * @returns True if the string is a valid hex string, false otherwise.
 */
export function isHex(v: unknown): v is Hex {
  if (!(typeof v === "string" && v.length % 2 === 0 && v.startsWith("0x"))) {
    return false;
  }

  for (let i = 2; i < v.length; i++) {
    const c = v.charAt(i);
    if (!(("0" <= c && c <= "9") || ("a" <= c && c <= "f"))) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the hexadecimal representation of the given value.
 *
 * @param hex - The value to convert, which can be a string, Uint8Array, ArrayBuffer, or number array.
 * @returns A Hex string representing the value.
 *
 * @example
 * ```typescript
 * const hexString = hexFrom("68656c6c6f"); // Outputs "0x68656c6c6f"
 * const hexStringFromBytes = hexFrom(new Uint8Array([104, 101, 108, 108, 111])); // Outputs "0x68656c6c6f"
 * ```
 */
export function hexFrom(hex: HexLike): Hex {
  // Passthru an already normalized hex. V8 optimization: maintain existing hidden string fields.
  if (isHex(hex)) {
    return hex;
  }

  return `0x${bytesTo(bytesFrom(hex), "hex")}`;
}
