/* eslint-disable @typescript-eslint/no-explicit-any */

import { bytesFrom, BytesLike } from "../bytes/index.js";
import {
  Num,
  numBeFromBytes,
  numBeToBytes,
  numFromBytes,
  numToBytes,
} from "../num/index.js";

export interface Codec<Encodable, Decodable = BytesLike> {
  byteLength?: number;
  encode: (encodable: Encodable) => Decodable;
  decode: (decodable: Decodable) => Encodable;
}

export type EncodableType<T extends Codec<any, any>> =
  T extends Codec<infer Encodable, any> ? Encodable : never;
export type DecodableType<T extends Codec<any, any>> =
  T extends Codec<any, infer Decodable> ? Decodable : never;

/**
 * Create a codec to deal with bytes-like data.
 * @param codec
 */
export function bytes<Encodable>(codec: Codec<Encodable>): Codec<Encodable> {
  return {
    encode: (userDefined) => bytesFrom(codec.encode(userDefined)),
    decode: (buffer) => codec.decode(buffer),
  };
}

/**
 * Create a codec to deal with bytes-like data with fixed length.
 * @param codec
 */
export function fixedBytes<Encodable>(
  codec: Codec<Encodable>,
): Codec<Encodable> {
  const byteLength = codec.byteLength;
  if (byteLength === undefined) {
    throw new Error("fixedBytes: require a byte length");
  }
  return {
    byteLength,
    encode: (userDefined) => {
      const encoded = bytesFrom(codec.encode(userDefined));
      if (encoded.byteLength !== byteLength) {
        throw new Error(
          `fixedBytes: invalid encode byte length, expected ${byteLength}, but got ${encoded.byteLength}`,
        );
      }
      return encoded;
    },
    decode: (buffer) => {
      const value = bytesFrom(buffer);
      if (value.byteLength !== byteLength) {
        throw new Error(
          `fixedBytes: invalid decode byte length, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      return codec.decode(buffer);
    },
  };
}

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function uint(byteLength: number, littleEndian = false) {
  return fixedBytes<Num>({
    byteLength,
    encode: (numberOrBigNumber) => {
      if (littleEndian) {
        return numToBytes(numberOrBigNumber, byteLength);
      } else {
        return numBeToBytes(numberOrBigNumber, byteLength);
      }
    },
    decode: (buffer) => {
      if (littleEndian) {
        return numFromBytes(buffer);
      } else {
        return numBeFromBytes(buffer);
      }
    },
  });
}
