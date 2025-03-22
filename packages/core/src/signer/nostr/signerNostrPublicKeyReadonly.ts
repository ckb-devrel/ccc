import { bech32 } from "bech32";
import { Client } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { SignerNostr } from "./signerNostr.js";

/**
 * Signer from Nostr public key
 * Support npub and hex format
 */
export class SignerNostrPublicKeyReadonly extends SignerNostr {
  public readonly publicKey: Hex;

  constructor(client: Client, publicKey: HexLike) {
    super(client);

    if (typeof publicKey === "string" && publicKey.startsWith("npub")) {
      const { words } = bech32.decode(publicKey);
      this.publicKey = hexFrom(bech32.fromWords(words));
    } else {
      this.publicKey = hexFrom(publicKey);
    }
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getNostrPublicKey(): Promise<Hex> {
    return this.publicKey;
  }
}
