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
      static byteLength?: number;
      static encode(_: SubTypeLike): Bytes {
        throw new Error(
          "encode not implemented, use @ccc.mol.codec to decorate your type",
        );
      }
      static decode(_: BytesLike): SubType {
        throw new Error(
          "decode not implemented, use @ccc.mol.codec to decorate your type",
        );
      }

      static fromBytes(_bytes: BytesLike): SubType {
        throw new Error(
          "fromBytes not implemented, use @ccc.mol.codec to decorate your type",
        );
      }

      toBytes(): Bytes {
        return (this.constructor as typeof Impl).encode(
          this as unknown as SubTypeLike,
        );
      }

      clone(): SubType {
        return (this.constructor as typeof Impl).fromBytes(
          this.toBytes(),
        ) as unknown as SubType;
      }

      eq(other: SubTypeLike | SubType): boolean {
        return bytesEq(
          this.toBytes(),
          /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
          (
            ((this.constructor as any)?.from(other) ?? other) as unknown as Impl
          ).toBytes(),
          /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
        );
      }

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
