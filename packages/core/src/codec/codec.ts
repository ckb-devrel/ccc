/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bytes, bytesFrom, BytesLike } from "../bytes/index.js";

export type CodecLike<Encodable, Decoded = Encodable> = {
  encode: (encodable: Encodable) => BytesLike;
  decode: (
    decodable: Bytes,
    config?: { isExtraFieldIgnored?: boolean },
  ) => Decoded;
  from?: ((encoded: Encodable) => Decoded) | null;
  byteLength?: number;
};
export class Codec<Encodable, Decoded = Encodable> {
  constructor(
    public readonly encode: (encodable: Encodable) => Bytes,
    public readonly decode: (
      decodable: BytesLike,
      config?: { isExtraFieldIgnored?: boolean }, // This is equivalent to "compatible" in the Rust implementation of Molecule.
    ) => Decoded,
    public readonly from: (encodable: Encodable) => Decoded,
    public readonly byteLength?: number, // if provided, treat codec as fixed length
  ) {}

  encodeOr<T>(encodable: Encodable, fallback: T): Bytes | T {
    try {
      return this.encode(encodable);
    } catch (_) {
      return fallback;
    }
  }

  decodeOr<T>(
    decodable: BytesLike,
    fallback: T,
    config?: { isExtraFieldIgnored?: boolean }, // This is equivalent to "compatible" in the Rust implementation of Molecule.
  ) {
    try {
      return this.decode(decodable, config);
    } catch (_) {
      return fallback;
    }
  }

  static from<Encodable, Decoded = Encodable>({
    encode,
    decode,
    from,
    byteLength,
  }: CodecLike<Encodable, Decoded>): Codec<Encodable, Decoded> {
    return new Codec(
      (encodable: Encodable) => {
        const encoded = bytesFrom(encode(encodable));
        if (byteLength !== undefined && encoded.byteLength !== byteLength) {
          throw new Error(
            `Codec.encode: expected byte length ${byteLength}, got ${encoded.byteLength}`,
          );
        }
        return encoded;
      },
      (decodable, config) => {
        const decodableBytes = bytesFrom(decodable);
        if (
          byteLength !== undefined &&
          decodableBytes.byteLength !== byteLength
        ) {
          throw new Error(
            `Codec.decode: expected byte length ${byteLength}, got ${decodableBytes.byteLength}`,
          );
        }
        return decode(decodableBytes, config);
      },
      from ?? ((encodable: Encodable) => decode(bytesFrom(encode(encodable)))),
      byteLength,
    );
  }

  map<NewEncodable = Encodable, NewDecoded = Decoded>({
    inMap,
    outMap,
    from,
  }: {
    inMap?: (encodable: NewEncodable) => Encodable;
    outMap?: (decoded: Decoded) => NewDecoded;
    from?: (encodable: NewEncodable) => NewDecoded;
  }): Codec<NewEncodable, NewDecoded> {
    const encode = inMap
      ? (encodable: NewEncodable) => this.encode(inMap(encodable))
      : (this.encode as unknown as (encodable: NewEncodable) => Bytes);
    const decode = outMap
      ? (buffer: BytesLike, config?: { isExtraFieldIgnored?: boolean }) =>
          outMap(this.decode(buffer, config))
      : (this.decode as unknown as (
          buffer: BytesLike,
          config?: { isExtraFieldIgnored?: boolean },
        ) => NewDecoded);
    const newFrom =
      from ??
      ((encodable: NewEncodable): NewDecoded => {
        const toEncode = (inMap ? inMap(encodable) : encodable) as Encodable;
        return (
          outMap ? outMap(this.from(toEncode)) : this.from(toEncode)
        ) as NewDecoded;
      });

    return new Codec(encode, decode, newFrom, this.byteLength);
  }

  mapIn<NewEncodable>(
    map: (encodable: NewEncodable) => Encodable,
  ): Codec<NewEncodable, Decoded> {
    return this.map({ inMap: map });
  }

  mapOut<NewDecoded>(
    map: (decoded: Decoded) => NewDecoded,
  ): Codec<Encodable, NewDecoded> {
    return this.map({ outMap: map });
  }
}

export type EncodableType<T extends CodecLike<any, any>> =
  T extends CodecLike<infer Encodable, unknown> ? Encodable : never;
export type DecodedType<T extends CodecLike<any, any>> =
  T extends CodecLike<any, infer Decoded> ? Decoded : never;
