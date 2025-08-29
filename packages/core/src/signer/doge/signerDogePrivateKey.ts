import { secp256k1 } from "@noble/curves/secp256k1";
import {
  Bytes,
  bytesConcat,
  bytesFrom,
  BytesLike,
  bytesTo,
} from "../../bytes/index.js";
import { Client } from "../../client/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { btcP2pkhAddressFromPublicKey } from "../btc/verify.js";
import { SignerDoge } from "./signerDoge.js";
import { messageHashDogeEcdsa } from "./verify.js";

/**
 * A class extending SignerDoge that provides access to a Doge address.
 * @public
 */
export class SignerDogePrivateKey extends SignerDoge {
  private readonly privateKey: Bytes;

  /**
   * Creates an instance of SignerDogePrivateKey
   *
   * @param client - The client instance used for communication.
   * @param privateKey - The Doge private key with the signer.
   */
  constructor(
    client: Client,
    privateKey: BytesLike,
    public readonly dogeNetwork = 0x1e,
  ) {
    super(client);
    this.privateKey = bytesFrom(privateKey);
    if (this.privateKey.length !== 32) {
      throw new Error("Private key must be 32 bytes!");
    }
  }

  /**
   * Connects to the client. This implementation does nothing as the class is always connected.
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

  async getDogePublicKey(): Promise<Hex> {
    return hexFrom(secp256k1.getPublicKey(this.privateKey, true));
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
    return btcP2pkhAddressFromPublicKey(
      await this.getDogePublicKey(),
      this.dogeNetwork,
    );
  }

  /**
   * Signs a message and returns signature only.
   *
   * @param msg - The message to sign, as a string or BytesLike object.
   * @returns A promise that resolves to the signature as a string.
   * @throws Will throw an error if not implemented.
   */
  async signMessageRaw(msg: string | BytesLike): Promise<string> {
    const challenge = typeof msg === "string" ? msg : hexFrom(msg).slice(2);

    const signature = secp256k1.sign(
      messageHashDogeEcdsa(challenge),
      this.privateKey,
    );

    return bytesTo(
      bytesConcat([31 + signature.recovery], signature.toCompactRawBytes()),
      "base64",
    );
  }
}
