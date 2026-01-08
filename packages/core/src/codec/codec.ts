/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bytes, bytesFrom, BytesLike } from "../bytes/index.js";

export type CodecLike<Encodable, Decoded = Encodable> = {
  readonly encode: (encodable: Encodable) => Bytes;
  readonly decode: (
    decodable: BytesLike,
    config?: { isExtraFieldIgnored?: boolean },
  ) => Decoded;
  readonly byteLength?: number;
};
export class Codec<Encodable, Decoded = Encodable> {
  constructor(
    public readonly encode: (encodable: Encodable) => Bytes,
    public readonly decode: (
      decodable: BytesLike,
      config?: { isExtraFieldIgnored?: boolean }, // This is equivalent to "compatible" in the Rust implementation of Molecule.
    ) => Decoded,
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
    byteLength,
  }: CodecLike<Encodable, Decoded>): Codec<Encodable, Decoded> {
    return new Codec(
      (encodable: Encodable) => {
        const encoded = encode(encodable);
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
        return decode(decodable, config);
      },
      byteLength,
    );
  }

  map<NewEncodable = Encodable, NewDecoded = Decoded>({
    inMap,
    outMap,
  }: {
    inMap?: (encodable: NewEncodable) => Encodable;
    outMap?: (decoded: Decoded) => NewDecoded;
  }): Codec<NewEncodable, NewDecoded> {
    return new Codec(
      (encodable) =>
        this.encode((inMap ? inMap(encodable) : encodable) as Encodable),
      (buffer, config) =>
        (outMap
          ? outMap(this.decode(buffer, config))
          : this.decode(buffer, config)) as NewDecoded,
      this.byteLength,
    );
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
