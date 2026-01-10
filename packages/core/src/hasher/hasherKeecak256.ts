import { keccak_256 } from "@noble/hashes/sha3.js";
import { BytesLike, bytesFrom } from "../bytes/index.js";
import { Hex, hexFrom } from "../hex/index.js";
import { Hasher } from "./hasher.js";

/**
 * @public
 */
export class HasherKeecak256 implements Hasher {
  private readonly hasher: ReturnType<(typeof keccak_256)["create"]>;

  /**
   * Creates an instance of Hasher.
   */

  constructor() {
    this.hasher = keccak_256.create();
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

  update(data: BytesLike): HasherKeecak256 {
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
