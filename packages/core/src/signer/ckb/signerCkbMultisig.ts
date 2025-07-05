import { Transaction, TransactionLike } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import { hexConcat, hexFrom, HexLike } from "../../hex/index.js";
import {
  MultisigInfoLike,
  SignerCkbMultisigReadonly,
} from "./signerCkbMultisigReadonly.js";
import { SignerCkbPrivateKey } from "./signerCkbPrivateKey.js";

/**
 * A class extending Signer that provides access to a CKB multisig script and supports signing operations.
 * @public
 */
export class SignerCkbMultisig extends SignerCkbMultisigReadonly {
  public readonly signer: SignerCkbPrivateKey;

  constructor(
    client: Client,
    privateKey: HexLike,
    multisigInfoLike: MultisigInfoLike,
  ) {
    super(client, multisigInfoLike);
    this.signer = new SignerCkbPrivateKey(client, privateKey);
  }

  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let lastIndex = -1;
    let tx = Transaction.from(txLike);
    const emptySignature = hexFrom(Array.from(new Array(65), () => 0));

    for (const { script } of await this.getRelatedScripts(tx)) {
      const index = await tx.findInputIndexByLock(script, this.client);
      if (index === undefined) {
        return tx;
      }
      if (index === lastIndex) {
        continue;
      } else {
        lastIndex = index;
      }

      let witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock?.startsWith(this.multisigInfo.metadata)) {
        tx = await this.prepareTransaction(tx);
      }

      witness = tx.getWitnessArgsAt(index);
      if (!witness || !witness.lock) {
        throw new Error("Multisig witness not prepared");
      }

      // Signatures array is placed after the multisig metadata, in 65 bytes per signature
      const signatures =
        witness.lock
          .slice(this.multisigInfo.metadata.length)
          .match(/.{1,130}/g)
          ?.map(hexFrom) || [];
      const insertIndex = signatures.findIndex((sig) => sig === emptySignature);
      if (signatures.length !== this.multisigInfo.threshold) {
        throw new Error(
          `Not enough signature slots to threshold (${signatures.length}/${this.multisigInfo.threshold})`,
        );
      }
      if (insertIndex === -1) {
        // Signatures have been filled
        continue;
      }

      // Empty multisig witness for current signing
      witness.lock = hexConcat(
        this.multisigInfo.metadata,
        ...Array.from(
          new Array(this.multisigInfo.threshold),
          () => emptySignature,
        ),
      );
      tx.setWitnessArgsAt(index, witness);
      const info = await tx.getSignHashInfo(script, this.client);
      if (!info) {
        continue;
      }

      const signature = await this.signer._signMessage(info.message);
      signatures[insertIndex] = signature;

      witness.lock = hexConcat(this.multisigInfo.metadata, ...signatures);
      tx.setWitnessArgsAt(index, witness);
    }

    return tx;
  }
}
