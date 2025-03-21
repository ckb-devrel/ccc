import { schnorr } from "@noble/curves/secp256k1";
import { Client } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { NostrEvent } from "./signerNostr.js";
import { SignerNostrPublicKeyReadonly } from "./signerNostrPublicKeyReadonly.js";
import { nostrEventHash } from "./verify.js";

export class SignerNostrPrivateKey extends SignerNostrPublicKeyReadonly {
  private readonly privateKey: Hex;

  constructor(client: Client, privateKeyLike: HexLike) {
    const privateKey = hexFrom(privateKeyLike);
    super(client, schnorr.getPublicKey(privateKey.slice(2)));

    this.privateKey = privateKey;
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
