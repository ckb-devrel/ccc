import { AddressType } from "./tx.js";

/**
 * Public key provider interface
 * Used to lookup public keys for addresses when building P2TR PSBT inputs
 *
 * @public
 */
export interface PublicKeyProvider {
  /**
   * Get the public key for a given address
   *
   * @param address - Bitcoin address
   * @param addressType - Address type (e.g., P2TR, P2WPKH)
   * @returns Public key in hex format (33-byte compressed or 32-byte x-only format), or undefined if not found
   */
  getPublicKey(
    address: string,
    addressType: AddressType,
  ): Promise<string | undefined>;
}
