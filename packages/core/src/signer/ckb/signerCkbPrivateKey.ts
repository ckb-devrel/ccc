import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesFrom, BytesLike } from "../../bytes/index.js";
import { Transaction, TransactionLike, WitnessArgs } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import {
  messageHashCkbSecp256k1,
  signMessageSecp256k1,
} from "./secp256k1Signing.js";
import { SignerCkbPublicKey } from "./signerCkbPublicKey.js";

/**
 * @public
 */
export class SignerCkbPrivateKey extends SignerCkbPublicKey {
  public readonly privateKey: Hex;

  constructor(client: Client, privateKey: HexLike) {
    const pk = hexFrom(privateKey);
    if (bytesFrom(pk).length !== 32) {
      throw new Error("Private key must be 32 bytes!");
    }

    super(client, secp256k1.getPublicKey(bytesFrom(pk), true));
    this.privateKey = pk;
  }

  async _signMessage(message: HexLike): Promise<Hex> {
    return signMessageSecp256k1(message, this.privateKey);
  }

  async signMessageRaw(message: string | BytesLike): Promise<Hex> {
    return this._signMessage(messageHashCkbSecp256k1(message));
  }

  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);

    for (const { script } of await this.getRelatedScripts(tx)) {
      const info = await tx.getSignHashInfo(script, this.client);
      if (!info) {
        return tx;
      }

      const signature = await this._signMessage(info.message);

      const witness =
        tx.getWitnessArgsAt(info.position) ?? WitnessArgs.from({});
      witness.lock = signature;
      tx.setWitnessArgsAt(info.position, witness);
    }

    return tx;
  }
}
