/* eslint-disable @typescript-eslint/no-explicit-any */

import { BytesLike } from "../bytes/index.js";
import {
  Num,
  numBeFromBytes,
  numBeToBytes,
  numFromBytes,
  NumLike,
  numToBytes,
} from "../num/index.js";

export interface Codec<Encodable, Decoded = Encodable> {
  byteLength?: number; // if provided, treat codec as fixed length
  encode: (encodable: Encodable) => BytesLike;
  decode: (decodable: BytesLike) => Decoded;
}

export type EncodableType<T extends Codec<any, any>> =
  T extends Codec<infer Encodable, any> ? Encodable : never;
export type DecodedType<T extends Codec<any, any>> =
  T extends Codec<any, infer Decoded> ? Decoded : never;

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function uint(
  byteLength: number,
  littleEndian = false,
): Codec<NumLike, Num> {
  return {
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
  };
}

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function uintNumber(
  byteLength: number,
  littleEndian = false,
): Codec<NumLike, number> {
  if (byteLength > 4) {
    throw new Error("uintNumber: byteLength must be less than or equal to 4");
  }
  const uintCodec = uint(byteLength, littleEndian);
  return {
    byteLength,
    encode: (numberOrBigNumber) => {
      return uintCodec.encode(numberOrBigNumber);
    },
    decode: (buffer) => {
      return Number(uintCodec.decode(buffer));
    },
  };
}
