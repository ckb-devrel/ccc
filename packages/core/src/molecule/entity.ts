import { Bytes, bytesEq, BytesLike } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex } from "../hex/index.js";
import { Constructor } from "../utils/index.js";
import { Codec } from "./codec.js";

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
    abstract class Impl {
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
          "encode not implemented, use @ccc.mol.codec to decorate your type",
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
          "decode not implemented, use @ccc.mol.codec to decorate your type",
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
          "fromBytes not implemented, use @ccc.mol.codec to decorate your type",
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
      clone(): SubType {
        return (this.constructor as typeof Impl).fromBytes(
          this.toBytes(),
        ) as unknown as SubType;
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
    }

    return Impl;
  }

  abstract toBytes(): Bytes;
  abstract hash(): Hex;
  abstract clone(): Entity;
}

/**
 * A class decorator to add methods implementation on the {@link Entity.Base} class
 * @example
 * ```typescript
 * @mol.codec(
 *   mol.table({
 *     codeHash: mol.Byte32,
 *     hashType: HashTypeCodec,
 *     args: mol.Bytes,
 *   }),
 * )
 * export class Script extends mol.Entity.Base<ScriptLike, Script>() {
 *   from(scriptLike: ScriptLike): Script {}
 * }
 * ```
 */
export function codec<
  Encodable,
  TypeLike extends Encodable,
  Decoded extends TypeLike,
>(codec: Codec<Encodable, Decoded>) {
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
    Constructor.encode = function (encodable: TypeLike) {
      return codec.encode(encodable);
    };
    Constructor.decode = function (bytesLike: BytesLike) {
      return Constructor.from(codec.decode(bytesLike));
    };
    Constructor.fromBytes = function (bytes: BytesLike) {
      return Constructor.from(codec.decode(bytes));
    };

    return Constructor;
  };
}
