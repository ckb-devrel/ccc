import { Transaction, TransactionLike } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { MultisigCkbWitnessLike } from "./multisigCkbWitness.js";
import {
  signMessageSecp256k1,
  verifyMessageSecp256k1,
} from "./secp256k1Signing.js";
import { SignerCkbPrivateKey } from "./signerCkbPrivateKey.js";
import {
  OmniLockMultisigOptions,
  SignerMultisigOmniLockReadonly,
} from "./signerMultisigOmniLockReadonly.js";

/**
 * A signing-capable signer for Omnilock cells using CKB multisig auth (0x06).
 *
 * Extends SignerMultisigOmniLockReadonly with the ability to sign transactions
 * using a single private key. For M-of-N multisig, each guard creates an
 * instance with their own private key. Partial signatures are aggregated via
 * `aggregateTransactions()`.
 *
 * @public
 */
export class SignerMultisigOmniLockPrivateKey extends SignerMultisigOmniLockReadonly {
  private readonly privateKey: Hex;
  private readonly signer: SignerCkbPrivateKey;

  /**
   * Creates an instance of SignerMultisigOmniLockPrivateKey.
   *
   * @param client - The client instance.
   * @param privateKey - The secp256k1 private key for this guard.
   * @param multisigInfoLike - The multisig configuration (all public keys, threshold, mustMatch).
   * @param options - Omnilock-specific options (flags, ACP minimums, script override).
   */
  constructor(
    client: Client,
    privateKey: HexLike,
    multisigInfoLike: MultisigCkbWitnessLike,
    options?: OmniLockMultisigOptions | null,
  ) {
    super(client, multisigInfoLike, options);

    this.privateKey = hexFrom(privateKey);
    this.signer = new SignerCkbPrivateKey(client, this.privateKey);
  }

  /**
   * Sign a transaction with this guard's private key.
   *
   * Finds the first empty signature slot in the multisig witness and fills it.
   * If this key has already signed, the transaction is returned unchanged.
   */
  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    let tx = Transaction.from(txLike);

    for (const { script } of await this.scriptInfos) {
      const info = await this.getSignInfo(tx, script);
      if (!info) {
        continue;
      }

      tx = await this.prepareWitnessArgsAt(
        tx,
        info.position,
        async (witness) => {
          if (
            witness.signatures.some(
              (sig) =>
                sig !== SignerMultisigOmniLockPrivateKey.EmptySignature &&
                verifyMessageSecp256k1(
                  info.message,
                  sig,
                  this.signer.publicKey,
                ),
            )
          ) {
            // Already signed by this key
            return;
          }

          const empty = witness.signatures.findIndex(
            (sig) => sig === SignerMultisigOmniLockPrivateKey.EmptySignature,
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
