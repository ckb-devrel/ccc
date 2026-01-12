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
function isNormalizedHex(v: unknown): v is Hex {
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
  // Pass through already-normalized hex to avoid allocating a new string.
  if (isNormalizedHex(hex)) {
    return hex;
  }

  return `0x${bytesTo(bytesFrom(hex), "hex")}`;
}

/**
 * Return the number of bytes occupied by `hexLike`.
 *
 * @param hexLike - Hex-like value
 * @returns Byte length of `hexLike`.
 *
 * @example
 * ```typescript
 * bytesLen("0x48656c6c6f") // 5
 * bytesLen(new Uint8Array([1, 2, 3])) // 3
 * bytesLen(new ArrayBuffer(4)) // 4
 * bytesLen([1, 2]) // 2
 * ```
 *
 * @see bytesLenUnsafe - Fast version for already-normalized Hex strings
 *
 * @note Prefer direct `.length`/`.byteLength` access on Uint8Array/ArrayBuffer when you already have bytes.
 *       Use `bytesLen()` only when you need length without performing additional operations.
 * @see bytesFrom - Convert values to Bytes (Uint8Array)
 */
export function bytesLen(hexLike: HexLike): number {
  if (isNormalizedHex(hexLike)) {
    return bytesLenUnsafe(hexLike);
  }

  return bytesFrom(hexLike).length;
}

/**
 * Fast byte length for Hex strings.
 *
 * This function efficiently calculates the byte length of Hex values:
 * - Skips validation (caller must ensure input is valid Hex)
 * - Handles odd-digit hex as if it were padded with a leading zero (e.g., "0x123" is treated as "0x0123").
 *
 * @param hex - A valid Hex string (with "0x" prefix).
 * @returns Byte length of the hex string.
 *
 * @example
 * ```typescript
 * bytesLenUnsafe("0x48656c6c6f") // 5
 * bytesLenUnsafe("0x123") // 2 (odd digits round up via padding)
 * ```
 *
 * @see bytesLen - Validated version for untrusted input
 */
export function bytesLenUnsafe(hex: Hex): number {
  return Math.floor((hex.length - 1) / 2);
}
