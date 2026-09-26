/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bytes, bytesFrom, BytesLike } from "../bytes/index.js";

export type CodecLike<Encodable, Decoded = Encodable, Context = any> = {
  readonly encode: (encodable: Encodable) => BytesLike;
  readonly decode: (decodable: Bytes, context?: Context) => Decoded;
  readonly from?: ((encodable: Encodable) => Decoded) | null;
  readonly byteLength?: number;
};
export class Codec<Encodable, Decoded = Encodable, Context = any> {
  constructor(
    public readonly encode: (encodable: Encodable) => Bytes,
    public readonly decode: (
      decodable: BytesLike,
      context?: Context,
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

  decodeOr<T>(decodable: BytesLike, fallback: T, context?: Context) {
    try {
      return this.decode(decodable, context);
    } catch (_) {
      return fallback;
    }
  }

  static from<Encodable, Decoded = Encodable, Context = any>(
    codecLike: CodecLike<Encodable, Decoded, Context>,
  ): Codec<Encodable, Decoded, Context> {
    const newEncode = function (encodable: Encodable) {
      const encoded = bytesFrom(codecLike.encode(encodable));
      if (
        codecLike.byteLength !== undefined &&
        encoded.byteLength !== codecLike.byteLength
      ) {
        throw new Error(
          `Codec.encode: expected byte length ${codecLike.byteLength}, got ${encoded.byteLength}`,
        );
      }
      return encoded;
    };
    const newDecode = function (decodable: BytesLike, context?: Context) {
      const decodableBytes = bytesFrom(decodable);
      if (
        codecLike.byteLength !== undefined &&
        decodableBytes.byteLength !== codecLike.byteLength
      ) {
        throw new Error(
          `Codec.decode: expected byte length ${codecLike.byteLength}, got ${decodableBytes.byteLength}`,
        );
      }
      return codecLike.decode(decodableBytes, context);
    };
    return new Codec(
      newEncode,
      newDecode,
      codecLike.from?.bind(codecLike) ??
        function (encodable: Encodable) {
          return newDecode(newEncode(encodable));
        },
      codecLike.byteLength,
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
  }): Codec<NewEncodable, NewDecoded, Context> {
    const encode = inMap
      ? (encodable: NewEncodable) => this.encode(inMap(encodable))
      : (this.encode as unknown as (encodable: NewEncodable) => Bytes);
    const decode = outMap
      ? (buffer: BytesLike, context?: Context) =>
          outMap(this.decode(buffer, context))
      : (this.decode as unknown as (
          buffer: BytesLike,
          context?: Context,
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
  ): Codec<NewEncodable, Decoded, Context> {
    return this.map({ inMap: map });
  }

  mapOut<NewDecoded>(
    map: (decoded: Decoded) => NewDecoded,
  ): Codec<Encodable, NewDecoded, Context> {
    return this.map({ outMap: map });
  }
}

export type EncodableType<T extends CodecLike<any, any, any>> =
  T extends CodecLike<infer Encodable, unknown, any> ? Encodable : never;
export type DecodedType<T extends CodecLike<any, any, any>> =
  T extends CodecLike<any, infer Decoded, any> ? Decoded : never;

type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * The context a codec specifically requires when composed with other codecs.
 * Legacy `any` is normalized to `unknown`, while `Extract` preserves that the
 * normalized type is assignable to the codec's original context.
 */
export type ContextType<T extends CodecLike<any, any, any>> = T extends {
  readonly decode: (decodable: Bytes, context?: infer Context) => unknown;
}
  ? Extract<IsAny<Context> extends true ? unknown : Context, Context>
  : unknown;

/**
 * The combined context required by every codec in a record.
 *
 * Map each child context to a function parameter before forming the union so a
 * legacy `any` (normalized to `unknown` by {@link ContextType}) cannot absorb
 * the other contexts. Inferring from the resulting contravariant parameter
 * position converts the function union into an intersection of its contexts.
 */
export type ChildContext<T extends Record<string, CodecLike<any, any, any>>> = {
  [K in keyof T]: (context: ContextType<T[K]>) => void;
}[keyof T] extends (context: infer Context) => void
  ? Context
  : unknown;
