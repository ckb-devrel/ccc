import { AddressType, PublicKeyProvider } from "../types/index.js";
import { RgbppBtcWallet } from "./wallet.js";

/**
 * Public key provider that retrieves public keys from a wallet
 *
 * @public
 */
export class WalletPublicKeyProvider implements PublicKeyProvider {
  constructor(private wallet: RgbppBtcWallet) {}

  async getPublicKey(
    address: string,
    addressType: AddressType,
  ): Promise<string | undefined> {
    // If it's the current wallet address, return its public key
    const currentAddress = await this.wallet.getAddress();
    if (address === currentAddress) {
      return await this.wallet.getPublicKey();
    }
    return undefined;
  }
}

/**
 * Public key provider that stores address-to-publickey mappings in memory
 *
 * @public
 */
export class CachedPublicKeyProvider implements PublicKeyProvider {
  private cache = new Map<string, string>();

  /**
   * Add an address-to-publickey mapping to the cache
   *
   * @param address - Bitcoin address
   * @param publicKey - Public key in hex format
   */
  addMapping(address: string, publicKey: string): void {
    this.cache.set(address, publicKey);
  }

  /**
   * Remove an address-to-publickey mapping from the cache
   *
   * @param address - Bitcoin address
   */
  removeMapping(address: string): void {
    this.cache.delete(address);
  }

  /**
   * Clear all cached mappings
   */
  clear(): void {
    this.cache.clear();
  }

  async getPublicKey(address: string): Promise<string | undefined> {
    return this.cache.get(address);
  }
}

/**
 * Composite public key provider that tries multiple providers in sequence
 *
 * @public
 */
export class CompositePublicKeyProvider implements PublicKeyProvider {
  constructor(private providers: PublicKeyProvider[]) {}

  /**
   * Add a provider to the end of the provider chain
   *
   * @param provider - The provider to add
   */
  addProvider(provider: PublicKeyProvider): void {
    this.providers.push(provider);
  }

  /**
   * Remove a provider from the provider chain
   *
   * @param provider - The provider to remove
   */
  removeProvider(provider: PublicKeyProvider): void {
    const index = this.providers.indexOf(provider);
    if (index > -1) {
      this.providers.splice(index, 1);
    }
  }

  async getPublicKey(
    address: string,
    addressType: AddressType,
  ): Promise<string | undefined> {
    // Try each provider in sequence until one returns a result
    for (const provider of this.providers) {
      const pubkey = await provider.getPublicKey(address, addressType);
      if (pubkey) {
        return pubkey;
      }
    }
    return undefined;
  }
}
