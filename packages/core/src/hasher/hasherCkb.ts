import { blake2b } from "@noble/hashes/blake2b";
import { BytesLike, bytesFrom } from "../bytes/index.js";
import { Hex, hexFrom } from "../hex/index.js";
import { CKB_BLAKE2B_PERSONAL } from "./advanced.js";
import { Hasher } from "./hasher.js";

/**
 * @public
 */
export class HasherCkb implements Hasher {
  private readonly hasher: ReturnType<(typeof blake2b)["create"]>;

  /**
   * Creates an instance of Hasher.
   *
   * @param outLength - The output length of the hash in bytes. Default is 32.
   * @param personal - The personal string for the Blake2b algorithm. Default is CKB_BLAKE2B_PERSONAL.
   */

  constructor(outLength = 32, personal = CKB_BLAKE2B_PERSONAL) {
    this.hasher = blake2b.create({
      personalization: personal,
      dkLen: outLength,
    });
  }

  /**
   * Updates the hash with the given data.
   *
   * @param data - The data to update the hash with.
   * @returns The current Hasher instance for chaining.
   *
   * @example
   * ```typescript
   * const hasher = new Hasher();
   * hasher.update("some data").update("more data");
   * const hash = hasher.digest();
   * ```
   */

  update(data: BytesLike): HasherCkb {
    this.hasher.update(bytesFrom(data));
    return this;
  }

  /**
   * Finalizes the hash and returns the digest as a hexadecimal string.
   *
   * @returns The hexadecimal string representation of the hash.
   *
   * @example
   * ```typescript
   * const hasher = new Hasher();
   * hasher.update("some data");
   * const hash = hasher.digest(); // Outputs something like "0x..."
   * ```
   */

  digest(): Hex {
    return hexFrom(this.hasher.digest());
  }
}

/**
 * Computes the CKB hash of the given data using the Blake2b algorithm.
 * @public
 *
 * @param data - The data to hash.
 * @returns The hexadecimal string representation of the hash.
 *
 * @example
 * ```typescript
 * const hash = hashCkb("some data"); // Outputs something like "0x..."
 * ```
 */

export function hashCkb(...data: BytesLike[]): Hex {
  const hasher = new HasherCkb();
  data.forEach((d) => hasher.update(d));
  return hasher.digest();
}
