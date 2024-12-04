/* eslint-disable @typescript-eslint/no-explicit-any */

import { BytesLike } from "../bytes/index.js";
import {
  Num,
  numBeFromBytes,
  numBeToBytes,
  numFromBytes,
  numToBytes,
} from "../num/index.js";

export interface Codec<Encodable, Decodable = BytesLike> {
  byteLength?: number; // if provided, treat codec as fixed length
  encode: (encodable: Encodable) => Decodable;
  decode: (decodable: Decodable) => Encodable;
}

export type EncodableType<T extends Codec<any, any>> =
  T extends Codec<infer Encodable, any> ? Encodable : never;
export type DecodableType<T extends Codec<any, any>> =
  T extends Codec<any, infer Decodable> ? Decodable : never;

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function uint(byteLength: number, littleEndian = false): Codec<Num> {
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
