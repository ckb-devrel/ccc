import { Bytes, bytesEq, bytesFrom, BytesLike } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex, hexFrom } from "../hex/index.js";
import type { UnionDecoded, UnionMatchHandlers } from "../molecule/codec.js";
import { Constructor } from "../utils/index.js";
import type { CodecLike, DecodedType } from "./codec.js";

/**
 * The base class of CCC to create a serializable instance. This should be used with the {@link codec} decorator.
 * @public
 */
export abstract class Entity {
  /**
   * Generate a base class of CCC to create a serializable instance.
   * This should be used with the {@link codec} decorator.
   * @public
   */
  static Base<SubTypeLike, SubType = SubTypeLike>() {
    abstract class Impl extends Entity {
      /**
       * The bytes length of the entity, if it is fixed, otherwise undefined
       * @public
       * @static
       */
      static byteLength?: number;
      /**
       * Encode the entity into bytes
       * @public
       * @static
       * @param _ - The entity to encode
       * @returns The encoded bytes
       * @throws Will throw an error if the entity is not serializable
       */
      static encode(_: SubTypeLike): Bytes {
        throw new Error(
          "encode not implemented, use @ccc.codec to decorate your type",
        );
      }
      /**
       * Decode the entity from bytes
       * @public
       * @static
       * @param _ - The bytes to decode
       * @returns The decoded entity
       * @throws Will throw an error if the entity is not serializable
       */
      static decode(_: BytesLike): SubType {
        throw new Error(
          "decode not implemented, use @ccc.codec to decorate your type",
        );
      }

      /**
       * Create an entity from bytes
       * @public
       * @static
       * @param _ - The bytes to create the entity from
       * @returns The created entity
       * @throws Will throw an error if the entity is not serializable
       */
      static fromBytes(_bytes: BytesLike): SubType {
        throw new Error(
          "fromBytes not implemented, use @ccc.codec to decorate your type",
        );
      }

      /**
       * Create an entity from a serializable object
       * @public
       * @static
       * @param _ - The serializable object to create the entity from
       * @returns The created entity
       * @throws Will throw an error if the entity is not serializable
       */
      static from(_: SubTypeLike): SubType {
        throw new Error("from not implemented");
      }

      /**
       * Convert the entity to bytes
       * @public
       * @returns The bytes representation of the entity
       */
      toBytes(): Bytes {
        return (this.constructor as typeof Impl).encode(
          this as unknown as SubTypeLike,
        );
      }

      /**
       * Create a clone of the entity
       * @public
       * @returns A clone of the entity
       */
      // @ts-expect-error SubType is always an Entity in practice, but TypeScript cannot infer this without a constraint on the type parameter
      clone(): SubType {
        return (this.constructor as typeof Impl).fromBytes(this.toBytes());
      }

      /**
       * Check if the entity is equal to another entity
       * @public
       * @param other - The other entity to compare with
       * @returns True if the entities are equal, false otherwise
       */
      eq(other: SubTypeLike): boolean {
        if (this === (other as unknown as this)) {
          return true;
        }

        return bytesEq(
          this.toBytes(),
          /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
          (
            ((this.constructor as any)?.from(other) ?? other) as unknown as Impl
          ).toBytes(),
          /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
        );
      }

      /**
       * Calculate the hash of the entity
       * @public
       * @returns The hash of the entity
       */
      hash(): Hex {
        return hashCkb(this.toBytes());
      }

      /**
       * Convert the entity to a full-byte untrimmed Hex representation
       * @public
       * @returns The entity full-byte untrimmed hexadecimal representation
       */
      toHex(): Hex {
        return hexFrom(this.toBytes());
      }
    }

    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    Impl.encode = undefined as any;
    Impl.decode = undefined as any;
    Impl.fromBytes = undefined as any;
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    return Impl;
  }

  /**
   * Convert the entity to bytes.
   * @public
   * @returns The bytes representation of the entity.
   */
  abstract toBytes(): Bytes;

  /**
   * Calculate the hash of the entity.
   * @public
   * @returns The hash of the entity.
   */
  abstract hash(): Hex;

  /**
   * Convert the entity to a full-byte untrimmed Hex representation.
   * @public
   * @returns The entity full-byte untrimmed hexadecimal representation.
   */
  abstract toHex(): Hex;

  /**
   * Create a clone of the entity.
   * @public
   * @returns A clone of the entity.
   */
  abstract clone(): Entity;

  /**
   * Generate a base class of CCC to create a serializable Union instance.
   * This should be used with the {@link codec} decorator.
   * @public
   */
  static BaseUnion<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CodecType extends CodecLike<any, UnionDecoded<any, any>>,
    SubTypeLike,
    SubType = SubTypeLike,
  >() {
    type Handlers<Result> = UnionMatchHandlers<CodecType, Result>;
    type Decoded = DecodedType<CodecType>;

    abstract class Impl extends Entity.Base<SubTypeLike, SubType>() {
      /**
       * The inner decoded object representing the union value.
       * @public
       */
      constructor(public readonly inner: Decoded) {
        super();
      }

      /**
       * Match the union type with a set of handlers.
       * @public
       * @param handlers - A map of type-specific handlers, all variants must be handled if no default handler `_` is provided.
       * @returns The result returned by the matching handler.
       */
      match<Result>(
        handlers: Handlers<Result> & {
          _?: undefined | null;
        },
      ): Result;
      /**
       * Match the union type with a set of handlers.
       * @public
       * @param handlers - A map of type-specific handlers, unmatched variants will be handled by the default handler `_`.
       * @returns The result returned by the matching handler.
       */
      match<Result>(
        handlers: Partial<Handlers<Result>> & {
          _: (inner: Decoded) => Result;
        },
      ): Result;
      match<Result>(
        handlers:
          | (Handlers<Result> & {
              _?: undefined | null;
            })
          | (Partial<Handlers<Result>> & {
              _: (inner: Decoded) => Result;
            }),
      ): Result {
        const type = this.inner.type as Decoded["type"];
        const handler = (handlers as Partial<Handlers<Result>>)[type];

        if (handler != undefined) {
          return handler(this.inner.value);
        }

        return (handlers._ as (inner: Decoded) => Result)(this.inner);
      }
    }

    return Impl;
  }
}

/**
 * A class decorator to add methods implementation on the {@link Entity.Base} class
 * @example
 * ```typescript
 * @codec(
 *   mol.table({
 *     codeHash: mol.Byte32,
 *     hashType: HashTypeCodec,
 *     args: mol.Bytes,
 *   }),
 * )
 * export class Script extends Entity.Base<ScriptLike, Script>() {
 *   from(scriptLike: ScriptLike): Script {}
 * }
 * ```
 */
export function codec<
  Encodable,
  TypeLike extends Encodable,
  Decoded extends TypeLike,
>(codec: {
  encode: (encodable: Encodable) => Bytes;
  decode: (
    decodable: Bytes,
    config?: { isExtraFieldIgnored?: boolean },
  ) => Decoded;
  byteLength?: number;
}) {
  return function <
    Type extends TypeLike,
    ConstructorType extends Constructor<Type> & {
      from(decoded: TypeLike): Type;
      byteLength?: number;
      encode(encodable: TypeLike): Bytes;
      decode(bytesLike: BytesLike): Type;
      fromBytes(bytes: BytesLike): Type;
    },
  >(Constructor: ConstructorType, ..._: unknown[]) {
    Constructor.byteLength = codec.byteLength;
    if (Constructor.encode === undefined) {
      Constructor.encode = function (encodable: TypeLike) {
        return codec.encode(Constructor.from(encodable));
      };
    }
    if (Constructor.decode === undefined) {
      Constructor.decode = function (bytesLike: BytesLike) {
        return Constructor.from(codec.decode(bytesFrom(bytesLike)));
      };
    }
    if (Constructor.fromBytes === undefined) {
      Constructor.fromBytes = function (bytes: BytesLike) {
        return Constructor.from(codec.decode(bytesFrom(bytes)));
      };
    }

    return Constructor;
  };
}
