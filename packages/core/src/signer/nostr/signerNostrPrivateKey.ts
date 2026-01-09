import { schnorr } from "@noble/curves/secp256k1.js";
import { bech32 } from "bech32";
import { Bytes, bytesFrom, BytesLike } from "../../bytes/index.js";
import { Client } from "../../client/index.js";
import { hexFrom } from "../../hex/index.js";
import { NostrEvent } from "./signerNostr.js";
import { SignerNostrPublicKeyReadonly } from "./signerNostrPublicKeyReadonly.js";
import { nostrEventHash } from "./verify.js";

/**
 * Signer from Nostr private key
 * Support nsec and hex format
 */
export class SignerNostrPrivateKey extends SignerNostrPublicKeyReadonly {
  private readonly privateKey: Bytes;

  constructor(client: Client, privateKeyLike: BytesLike) {
    const privateKey = (() => {
      if (
        typeof privateKeyLike === "string" &&
        privateKeyLike.startsWith("nsec")
      ) {
        const { words } = bech32.decode(privateKeyLike);
        return bytesFrom(bech32.fromWords(words));
      }

      return bytesFrom(privateKeyLike);
    })();

    super(client, schnorr.getPublicKey(privateKey));

    this.privateKey = privateKey;
  }

  async signNostrEvent(event: NostrEvent): Promise<Required<NostrEvent>> {
    const pubkey = (await this.getNostrPublicKey()).slice(2);
    const eventHash = nostrEventHash({ ...event, pubkey });
    const signature = schnorr.sign(eventHash, this.privateKey);

    return {
      ...event,
      id: hexFrom(eventHash).slice(2),
      pubkey,
      sig: hexFrom(signature).slice(2),
    };
  }
}
