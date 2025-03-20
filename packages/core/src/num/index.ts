import { Bytes, BytesLike, bytesConcat, bytesFrom } from "../bytes/index.js";
import { Hex, HexLike, hexFrom } from "../hex/index.js";

/**
 * Represents a numeric value as a bigint.
 * @public
 */
export type Num = bigint;

/**
 * Represents a value that can be converted to a numeric value.
 * It can be a string, number, bigint, or HexLike.
 * @public
 */
export type NumLike = string | number | bigint | HexLike;

/**
 * Get the min among all numbers.
 * @public
 *
 * @param numbers - numbers.
 * @returns The min numbers among them.
 *
 * @example
 * ```typescript
 * numMin(1, 2, 3); // Outputs 1n
 * ```
 */
export function numMin(a: NumLike, ...numbers: NumLike[]): Num {
  let min = numFrom(a);
  numbers.forEach((nLike) => {
    const n = numFrom(nLike);
    if (n < min) {
      min = n;
    }
  });
  return min;
}

/**
 * Get the max among all numbers.
 * @public
 *
 * @param numbers - numbers.
 * @returns The max numbers among them.
 *
 * @example
 * ```typescript
 * numMax(1, 2, 3); // Outputs 3n
 * ```
 */
export function numMax(a: NumLike, ...numbers: NumLike[]): Num {
  let max = numFrom(a);
  numbers.forEach((nLike) => {
    const n = numFrom(nLike);
    if (n > max) {
      max = n;
    }
  });
  return max;
}

/**
 * Converts a NumLike value to a Num (bigint).
 * @public
 *
 * @param val - The value to convert, which can be a string, number, bigint, or HexLike.
 * @returns A Num (bigint) representing the value.
 *
 * @example
 * ```typescript
 * const num = numFrom("12345"); // Outputs 12345n
 * const numFromHex = numFrom("0x3039"); // Outputs 12345n
 * ```
 */
export function numFrom(val: NumLike): Num {
  if (typeof val === "bigint") {
    return val;
  }

  if (val === "0x") {
    return BigInt(0);
  }
  if (typeof val === "string" || typeof val === "number") {
    return BigInt(val);
  }

  const hex = hexFrom(val);
  return BigInt(hex);
}

/**
 * Converts a NumLike value to a hexadecimal string.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, bigint, or HexLike.
 * @returns A Hex string representing the numeric value.
 *
 * @example
 * ```typescript
 * const hex = numToHex(12345); // Outputs "0x3039"
 * ```
 */
export function numToHex(val: NumLike): Hex {
  return `0x${numFrom(val).toString(16)}`;
}

/**
 * Converts a NumLike value to a byte array in little-endian order.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, bigint, or HexLike.
 * @param bytes - The number of bytes to use for the representation. If not provided, the exact number of bytes needed is used.
 * @returns A Uint8Array containing the byte representation of the numeric value.
 *
 * @example
 * ```typescript
 * const bytes = numToBytes(12345, 4); // Outputs Uint8Array [57, 48, 0, 0]
 * ```
 */

export function numToBytes(val: NumLike, bytes?: number): Bytes {
  return numLeToBytes(val, bytes);
}

/**
 * Converts a NumLike value to a byte array in little-endian order.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, bigint, or HexLike.
 * @param bytes - The number of bytes to use for the representation. If not provided, the exact number of bytes needed is used.
 * @returns A Uint8Array containing the byte representation of the numeric value.
 *
 * @example
 * ```typescript
 * const bytes = numLeToBytes(12345, 4); // Outputs Uint8Array [57, 48, 0, 0]
 * ```
 */
export function numLeToBytes(val: NumLike, bytes?: number): Bytes {
  return numBeToBytes(val, bytes).reverse();
}

/**
 * Converts a NumLike value to a byte array in big-endian order.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, bigint, or HexLike.
 * @param bytes - The number of bytes to use for the representation. If not provided, the exact number of bytes needed is used.
 * @returns A Uint8Array containing the byte representation of the numeric value.
 *
 * @example
 * ```typescript
 * const bytes = numBeToBytes(12345, 4); // Outputs Uint8Array [0, 0, 48, 57]
 * ```
 */
export function numBeToBytes(val: NumLike, bytes?: number): Bytes {
  let num = numFrom(val);
  if (num < numFrom(0)) {
    if (bytes == null) {
      throw Error(
        "negative number can not be serialized without knowing bytes length",
      );
    }

    // 0x100............00 - abs(num)
    //    | . bytes * 8 .|
    // 2's complement for negative number
    num = (numFrom(1) << (numFrom(8) * numFrom(bytes))) + num;
    if (num < 0) {
      throw Error("negative number underflow");
    }
  }

  const rawBytes = bytesFrom(num.toString(16));
  if (bytes == null) {
    return rawBytes;
  }

  if (rawBytes.length > bytes) {
    throw Error("number overflow");
  }
  return bytesConcat("00".repeat(bytes - rawBytes.length), rawBytes);
}

/**
 * Converts a byte array to a Num (bigint) assuming little-endian order.
 * @public
 *
 * @param val - The byte array to convert.
 * @returns A Num (bigint) representing the numeric value.
 *
 * @example
 * ```typescript
 * const num = numFromBytes(new Uint8Array([57, 48, 0, 0])); // Outputs 12345n
 * ```
 */
export function numFromBytes(val: BytesLike): Num {
  return numLeFromBytes(val);
}

/**
 * Converts a byte array to a Num (bigint) assuming little-endian order.
 * @public
 *
 * @param val - The byte array to convert.
 * @returns A Num (bigint) representing the numeric value.
 *
 * @example
 * ```typescript
 * const num = numLeFromBytes(new Uint8Array([57, 48, 0, 0])); // Outputs 12345n
 * ```
 */
export function numLeFromBytes(val: BytesLike): Num {
  // reverse() modifies the original array
  // so we use the map to copy it to avoid this
  return numBeFromBytes(
    bytesFrom(val)
      .map((v) => v)
      .reverse(),
  );
}

/**
 * Converts a byte array to a Num (bigint) assuming big-endian order.
 * @public
 *
 * @param val - The byte array to convert.
 * @returns A Num (bigint) representing the numeric value.
 *
 * @example
 * ```typescript
 * const num = numBeFromBytes(new Uint8Array([0, 0, 48, 57])); // Outputs 12345n
 * ```
 */
export function numBeFromBytes(val: BytesLike): Num {
  return numFrom(bytesFrom(val));
}
