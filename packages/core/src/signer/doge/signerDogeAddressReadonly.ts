import { Client } from "../../client/index.js";
import { SignerDoge } from "./signerDoge.js";

/**
 * A class extending SignerDoge that provides read-only access to a Doge address.
 * This class does not support signing operations.
 * @public
 */
export class SignerDogeAddressReadonly extends SignerDoge {
  /**
   * Creates an instance of SignerDogeAddressReadonly.
   *
   * @param client - The client instance used for communication.
   * @param address - The Doge address with the signer.
   */
  constructor(
    client: Client,
    private readonly address: string,
  ) {
    super(client);
  }

  /**
   * Connects to the client. This implementation does nothing as the class is read-only.
   *
   * @returns A promise that resolves when the connection is complete.
   */
  async connect(): Promise<void> {}

  /**
   * Check if the signer is connected.
   *
   * @returns A promise that resolves the connection status.
   */
  async isConnected(): Promise<boolean> {
    return true;
  }

  /**
   * Gets the Doge address associated with the signer.
   *
   * @returns A promise that resolves to a string representing the Doge address.
   *
   * @example
   * ```typescript
   * const account = await signer.getDogeAddress(); // Outputs the Doge address
   * ```
   */
  async getDogeAddress(): Promise<string> {
    return this.address;
  }
}
