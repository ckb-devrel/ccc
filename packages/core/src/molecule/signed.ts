import { bytesFrom } from "../bytes/index.js";
import { Num, numFrom, NumLike} from "../num/index.js";
import { Codec, option, vector } from "./codec.js";

/**
 * Codec for encoding and decoding 8-bit signed integers.
 */
export const Int8 = Codec.from<NumLike, number>({
  byteLength: 1,
  /**
   * Encodes a number-like value into Bytes.
   * @param numLike - The number-like value to encode.
   * @returns Bytes containing the encoded value.
   */
  encode: (numLike) => {
    const encoded = new Uint8Array(1);
    new DataView(encoded.buffer).setInt8(0, Number(numLike));
    return encoded;
  },
  /**
   * Decodes Bytes into a number.
   * @param bytesLike - The bytes-like input to decode.
   * @returns The decoded 8-bit signed integer.
   */
  decode: (bytesLike) => {
    const bytes = bytesFrom(bytesLike);
    return new DataView(bytes.buffer).getInt8(0);
  },
});

/**
 * Option codec for 8-bit signed integers.
 */
export const Int8Opt = option(Int8);

/**
 * Vector codec for arrays of 8-bit signed integers.
 */
export const Int8Vec = vector(Int8);

/**
 * Creates a codec for encoding and decoding 16-bit signed integers.
 * @param littleEndian - Indicates whether to use little-endian byte order.
 * @returns A codec for 16-bit signed integers.
 */
function int16Number(littleEndian: boolean): Codec<NumLike, number> {
  const byteLength = 2;
  return Codec.from({
    byteLength,
    /**
     * Encodes a number-like value into Bytes.
     * @param numLike - The number-like value to encode.
     * @returns Bytes containing the encoded value.
     */
    encode: (numLike) => {
      const encoded = new Uint8Array(byteLength);
      new DataView(encoded.buffer).setInt16(0, Number(numLike), littleEndian);
      return encoded;
    },
    /**
     * Decodes Bytes into a number.
     * @param bytesLike - The bytes-like input to decode.
     * @returns The decoded 16-bit signed integer.
     */
    decode: (bytesLike) => {
      const bytes = bytesFrom(bytesLike);
      return new DataView(bytes.buffer).getInt16(0, littleEndian);
    },
  });
}

/**
 * Codec for little-endian 16-bit signed integers.
 */
export const Int16LE = int16Number(true);

/**
 * Codec for big-endian 16-bit signed integers.
 */
export const Int16BE = int16Number(false);

/**
 * Codec for 16-bit signed integers (alias for little-endian).
 */
export const Int16 = Int16LE;

/**
 * Option codec for 16-bit signed integers.
 */
export const Int16Opt = option(Int16);

/**
 * Vector codec for arrays of 16-bit signed integers.
 */
export const Int16Vec = vector(Int16);

/**
 * Creates a codec for encoding and decoding 32-bit signed integers.
 * @param littleEndian - Indicates whether to use little-endian byte order.
 * @returns A codec for 32-bit signed integers.
 */
function int32Number(littleEndian: boolean): Codec<NumLike, number> {
  const byteLength = 4;
  return Codec.from({
    byteLength,
    /**
     * Encodes a number-like value into Bytes.
     * @param numLike - The number-like value to encode.
     * @returns Bytes containing the encoded value.
     */
    encode: (numLike) => {
      const encoded = new Uint8Array(byteLength);
      new DataView(encoded.buffer).setInt32(0, Number(numLike), littleEndian);
      return encoded;
    },
    /**
     * Decodes Bytes into a number.
     * @param bytesLike - The bytes-like input to decode.
     * @returns The decoded 32-bit signed integer.
     */
    decode: (bytesLike) => {
      const bytes = bytesFrom(bytesLike);
      return new DataView(bytes.buffer).getInt32(0, littleEndian);
    },
  });
}

/**
 * Codec for little-endian 32-bit signed integers.
 */
export const Int32LE = int32Number(true);

/**
 * Codec for big-endian 32-bit signed integers.
 */
export const Int32BE = int32Number(false);

/**
 * Codec for 32-bit signed integers (alias for little-endian).
 */
export const Int32 = Int32LE;

/**
 * Option codec for 32-bit signed integers.
 */
export const Int32Opt = option(Int32);

/**
 * Vector codec for arrays of 32-bit signed integers.
 */
export const Int32Vec = vector(Int32);

/**
 * Creates a codec for encoding and decoding 64-bit signed integers.
 * @param littleEndian - Indicates whether to use little-endian byte order.
 * @returns A codec for 64-bit signed integers.
 */
function int64(littleEndian: boolean): Codec<NumLike, Num> {
  const byteLength = 8;
  return Codec.from({
    byteLength,
    /**
     * Encodes a number-like value into Bytes.
     * @param numLike - The number-like value to encode.
     * @returns Bytes containing the encoded value.
     */
    encode: (numLike) => {
      const encoded = new Uint8Array(byteLength);
      new DataView(encoded.buffer).setBigInt64(
        0,
        numFrom(numLike),
        littleEndian,
      );
      return encoded;
    },
    /**
     * Decodes Bytes into a number.
     * @param bytesLike - The bytes-like input to decode.
     * @returns The decoded 64-bit signed integer.
     */
    decode: (bytesLike) => {
      const bytes = bytesFrom(bytesLike);
      return new DataView(bytes.buffer).getBigInt64(0, littleEndian);
    },
  });
}

/**
 * Codec for little-endian 64-bit signed integers.
 */
export const Int64LE = int64(true);

/**
 * Codec for big-endian 64-bit signed integers.
 */
export const Int64BE = int64(false);

/**
 * Codec for 64-bit signed integers (alias for little-endian).
 */
export const Int64 = Int64LE;

/**
 * Option codec for 64-bit signed integers.
 */
export const Int64Opt = option(Int64);

/**
 * Vector codec for arrays of 64-bit signed integers.
 */
export const Int64Vec = vector(Int64);
