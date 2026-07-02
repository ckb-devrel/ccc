import { Bytes, bytesEq, bytesFrom, BytesLike } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex, hexFrom } from "../hex/index.js";
import { Constructor } from "../utils/index.js";
import { Codec, CodecLike } from "./codec.js";

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
    // Static methods in this class are written in function syntax not method syntax
    // to enable strictFunctionTypes to catch more errors.
    // This protects when the class is extended and the static methods are overridden with incompatible types.
    // See https://www.typescriptlang.org/tsconfig/#strictFunctionTypes
    // >> During development of this feature, we discovered a large number of inherently unsafe class hierarchies,
    // >> including some in the DOM. Because of this, the setting only applies to functions written in function syntax,
    // >> not to those in method syntax
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
      static encode: (_: SubTypeLike) => Bytes;
      /**
       * Decode the entity from bytes
       * @public
       * @static
       * @param _ - The bytes to decode
       * @param _config - The configuration for decoding, including whether to ignore extra fields
       * @returns The decoded entity
       * @throws Will throw an error if the entity is not serializable
       */
      static decode: (
        _: BytesLike,
        _config?: { isExtraFieldIgnored?: boolean },
      ) => SubType;

      /**
       * Create an entity from bytes
       * @public
       * @static
       * @param _ - The bytes to create the entity from
       * @param _config - The configuration for decoding, including whether to ignore extra fields
       * @returns The created entity
       * @throws Will throw an error if the entity is not serializable
       */
      static fromBytes: (
        _bytes: BytesLike,
        _config?: { isExtraFieldIgnored?: boolean },
      ) => SubType;

      /**
       * Create an entity from a serializable object
       * @public
       * @static
       * @param _ - The serializable object to create the entity from
       * @returns The created entity
       * @throws Will throw an error if the entity is not serializable
       */
      static from: (_: SubTypeLike) => SubType;

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
          (
            (this.constructor as typeof Impl).from(other) as unknown as Impl
          ).toBytes(),
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

    return Impl;
  }

  abstract toBytes(): Bytes;
  abstract hash(): Hex;
  abstract toHex(): Hex;
  abstract clone(): Entity;
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
export function codec<Encodable, Decoded>(
  codecLike: CodecLike<Encodable, Decoded>,
) {
  const codec = Codec.from(codecLike);

  return function <
    TypeLike extends Encodable,
    Type extends TypeLike,
    ConstructorType extends Constructor<Type>,
  >(
    Constructor: ConstructorType &
      Omit<CodecLike<TypeLike, Type>, "from"> & {
        // Since Base.from only accepts TypeLike,
        // passing this check actually tells us that Decoded extends TypeLike
        from: (encodable: TypeLike | Decoded) => Type;
        fromBytes: (bytes: BytesLike) => Type;
      },
    ..._: unknown[]
  ): void {
    const Base = Object.getPrototypeOf(Constructor) as Omit<
      CodecLike<TypeLike, Type>,
      "from"
    > & {
      fromBytes: (bytes: BytesLike) => Type;
    };

    Base.byteLength = codec.byteLength;
    if (Base.encode === undefined) {
      Base.encode = function (this: typeof Constructor, encodable: TypeLike) {
        // Theoretically, the type allows us to codec.encode(encodable) directly.
        // However, Constructor.from usually does more than just casting the type,
        // so we need to call it to ensure the correct data is passed to codec.encode.
        return codec.encode(this.from(encodable));
      };
    }
    if (Base.decode === undefined) {
      Base.decode = function (
        this: typeof Constructor,
        bytesLike: BytesLike,
        config?: { isExtraFieldIgnored?: boolean },
      ) {
        return this.from(codec.decode(bytesFrom(bytesLike), config));
      };
    }
    if (Base.fromBytes === undefined) {
      Base.fromBytes = function (
        this: typeof Constructor,
        bytes: BytesLike,
        config?: { isExtraFieldIgnored?: boolean },
      ) {
        return this.from(codec.decode(bytesFrom(bytes), config));
      };
    }
  };
}
