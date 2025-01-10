import { schnorr } from "@noble/curves/secp256k1";
import { Client } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { NostrEvent, SignerNostr } from "./signerNostr.js";
import { nostrEventHash } from "./verify.js";

export class SignerNostrPrivateKey extends SignerNostr {
  private readonly privateKey: Hex;

  constructor(client: Client, privateKey: HexLike) {
    super(client);
    this.privateKey = hexFrom(privateKey);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getNostrPublicKey(): Promise<Hex> {
    return hexFrom(schnorr.getPublicKey(this.privateKey.slice(2)));
  }

  async signNostrEvent(event: NostrEvent): Promise<Required<NostrEvent>> {
    const pubkey = (await this.getNostrPublicKey()).slice(2);
    const eventHash = nostrEventHash({ ...event, pubkey });
    const signature = schnorr.sign(eventHash, this.privateKey.slice(2));

    return {
      ...event,
      id: hexFrom(eventHash).slice(2),
      pubkey,
      sig: hexFrom(signature).slice(2),
    };
  }
}
