import { SinceLike, Transaction, TransactionLike } from "../../ckb/index.js";
import { Client, KnownScript, ScriptInfoLike } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import {
  signMessageSecp256k1,
  verifyMessageSecp256k1,
} from "./secp256k1Signing.js";
import { SignerCkbPrivateKey } from "./signerCkbPrivateKey.js";
import {
  MultisigCkbWitnessLike,
  SignerMultisigCkbReadonly,
} from "./signerMultisigCkbReadonly.js";

/**
 * A class extending Signer that provides access to a CKB multisig script and supports signing operations.
 * @public
 */
export class SignerMultisigCkbPrivateKey extends SignerMultisigCkbReadonly {
  private readonly privateKey: Hex;
  private readonly signer: SignerCkbPrivateKey;

  /**
   * Creates an instance of SignerMultisigCkbPrivateKey.
   *
   * @param client - The client instance.
   * @param privateKey - The private key.
   * @param multisigInfo - The multisig information.
   * @param options - The options.
   */
  constructor(
    client: Client,
    privateKey: HexLike,
    multisigInfo: MultisigCkbWitnessLike,
    options?: {
      since?: SinceLike | null;
      scriptInfos?: (KnownScript | ScriptInfoLike)[] | null;
    } | null,
  ) {
    super(client, multisigInfo, options);

    this.privateKey = hexFrom(privateKey);
    this.signer = new SignerCkbPrivateKey(client, this.privateKey);
  }

  /**
   * Sign a transaction only (without preparing).
   *
   * @param txLike - The transaction to sign.
   * @returns The signed transaction.
   */
  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let tx = Transaction.from(txLike);

    for (const { script } of await this.scriptInfos) {
      const info = await this.getSignInfo(tx, script);
      if (!info) {
        continue;
      }

      // === Find a position for the signature ===
      tx = await this.prepareWitnessArgsAt(
        tx,
        info.position,
        async (witness) => {
          if (
            witness.signatures.some(
              (sig) =>
                sig !== SignerMultisigCkbPrivateKey.EmptySignature &&
                verifyMessageSecp256k1(
                  info.message,
                  sig,
                  this.signer.publicKey,
                ),
            )
          ) {
            // Has signed
            return;
          }

          const empty = witness.signatures.findIndex(
            (sig) => sig === SignerMultisigCkbPrivateKey.EmptySignature,
          );
          if (empty === -1) {
            return;
          }

          const signature = signMessageSecp256k1(info.message, this.privateKey);

          witness.signatures[empty] = signature;
        },
      );
    }

    return tx;
  }
}
