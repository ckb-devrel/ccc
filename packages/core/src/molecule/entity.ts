import { Bytes, bytesEq, BytesLike } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex } from "../hex/index.js";
import { Codec } from "./codec.js";

/**
 * The base class of CCC to create a serializable instance
 * @public
 */
export abstract class Entity {
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
      eq(other: SubTypeLike | SubType): boolean {
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

export function codec<
  Encodable,
  TypeLike extends Encodable,
  Decoded extends TypeLike,
  Type extends object & TypeLike,
  ConstructorType extends {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): Type;
    from(decoded: TypeLike): Type;
    byteLength?: number;
    encode(encodable: TypeLike): Bytes;
    decode(bytesLike: BytesLike): TypeLike;
    fromBytes(bytes: BytesLike): Type;
  },
>(codec: Codec<Encodable, Decoded>) {
  return function (Constructor: ConstructorType) {
    return class Extended extends Constructor {
      static byteLength = codec.byteLength;
      static encode(encodable: TypeLike): Bytes {
        return codec.encode(encodable);
      }
      static decode(bytesLike: BytesLike): Type {
        return Constructor.from(codec.decode(bytesLike));
      }

      static fromBytes(bytes: BytesLike): Type {
        return Constructor.from(codec.decode(bytes));
      }
    };
  };
}
