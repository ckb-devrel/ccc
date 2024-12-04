import { Bytes, bytesEqual, bytesFrom, BytesLike } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { Hex } from "../hex/index.js";

/**
 * The base class of CCC to create a serializable instance
 * @public
 */
export class Base {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static fromBytes<T extends Base>(bytes: BytesLike): T {
    throw new Error(
      `"${this.name}" has to implement the static "fromBytes" method`,
    );
  }

  toBytes(): Bytes {
    throw new Error(
      `"${this.constructor.name}" has to implement the "toBytes" method`,
    );
  }

  clone(): this {
    return (this.constructor as typeof Base).fromBytes(this.toBytes());
  }

  eq(other: this): boolean {
    return bytesEqual(this.toBytes(), other.toBytes());
  }

  hash(): Hex {
    return hashCkb(this.toBytes());
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<Instance = any, Args extends any[] = any[]> = new (
  ...args: Args
) => Instance;

/**
 * A helper function to implement the "fromBytes" and "toBytes" method on the {@link Base} class
 * @example
 * ```typescript
 * extendsBase(
 *   class Script extends Base {
 *     constructor(public codeHash: Hex, public hashType: HashType, public args: Hex) {}
 *   }
 *   bytesToConstructorParams,
 *   scriptToBytes,
 * )
 * ```
 */
export function extendsBase<
  C extends Constructor<Base>,
  const P extends ConstructorParameters<C> = ConstructorParameters<C>,
>(
  FromBase: C,
  bytesToConstructorParams: (bytes: Uint8Array) => P,
  instanceToBytes: (instance: InstanceType<C>) => BytesLike,
): { fromBytes(bytes: BytesLike): InstanceType<C> } & C {
  class Impl extends FromBase {
    static fromBytes(bytesLike: BytesLike): InstanceType<C> {
      const params = bytesToConstructorParams(bytesFrom(bytesLike));
      return new Impl(...params) as InstanceType<C>;
    }

    toBytes() {
      return bytesFrom(instanceToBytes(this as InstanceType<C>));
    }
  }

  Object.defineProperty(Impl, "name", { value: FromBase.name });

  return Impl;
}
