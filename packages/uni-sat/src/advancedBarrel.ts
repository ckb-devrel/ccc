/**
 * Interface representing a provider for interacting with accounts and signing messages.
 */
export interface Provider {
  // TODO: tweaked signer for taproot
  signPsbt(psbtHex: string): Promise<string>;

  pushPsbt(psbtHex: string): Promise<string>;

  /**
   * Requests user accounts.
   * @returns A promise that resolves to an array of account addresses.
   */
  requestAccounts(): Promise<string[]>;

  /**
   * Gets the current network.
   * @returns current network.
   */
  getNetwork(): Promise<"livenet" | "testnet">;

  /**
   * Switch the current network.
   */
  switchNetwork(chain: "livenet" | "testnet"): Promise<void>;

  /**
   * Gets the current chain.
   * @returns current chain.
   */
  getChain?(): Promise<{ enum: string; name: string; network: string }>;

  /**
   * Switch the current chain.
   */
  switchChain?(
    chain: string,
  ): Promise<{ enum: string; name: string; network: string }>;

  /**
   * Gets the current accounts.
   * @returns A promise that resolves to an array of account addresses.
   */
  getAccounts(): Promise<string[]>;

  /**
   * Gets the public key of the account.
   * @returns A promise that resolves to the public key.
   */
  getPublicKey(): Promise<string>;

  /**
   * Signs a message with the specified type.
   * @param msg - The message to sign.
   * @param type - The type of signature.
   * @returns A promise that resolves to the signed message.
   */
  signMessage(msg: string, type: "ecdsa" | "bip322-simple"): Promise<string>;

  /**
   * Adds an event listener to the provider.
   */
  on: OnMethod;

  /**
   * Removes an event listener from the provider.
   * @param eventName - The name of the event to remove the listener from.
   * @param listener - The listener function to remove.
   * @returns The provider instance.
   */
  removeListener(
    eventName: string,
    listener: (...args: unknown[]) => unknown,
  ): Provider;
}

/**
 * Interface representing a method to add event listeners to the provider.
 */
export interface OnMethod {
  /**
   * Adds an event listener to the provider.
   * @param eventName - The name of the event.
   * @param listener - The listener function.
   * @returns The provider instance.
   */
  (eventName: string, listener: (...args: unknown[]) => unknown): Provider;
}
