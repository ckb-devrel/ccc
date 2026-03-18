import { SinceLike, Transaction, TransactionLike } from "../../ckb/index.js";
import { Client, KnownScript, ScriptInfoLike } from "../../client/index.js";
import { hashCkbShort } from "../../hasher/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { signMessageSecp256k1 } from "./secp256k1Signing.js";
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

    const thisPubkeyHash = hashCkbShort(this.signer.publicKey);

    const index = this.multisigInfo.publicKeyHashes.indexOf(thisPubkeyHash);
    if (index === -1) {
      return tx;
    }
    const isSelfRequired = index < this.multisigInfo.mustMatch;

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
          // We re-evaluate the signatures to filter invalid / excessive signatures
          const signatures: Hex[] = [];
          let requiredCount = 0;

          // === Returns if: ===
          // === 1. This signer already signed the transaction ===
          // === 2. The transaction already has enough flexible signatures, and this signer is not required ===
          // === 3. `mustMatch` equals to `threshold` but we have more this signer is not required.
          for (const {
            pubkeyHash,
            signature,
            isRequired,
          } of witness.generatePublicKeyHashesFromSignatures(info.message)) {
            if (pubkeyHash === thisPubkeyHash) {
              // Has signed
              return;
            }

            if (isRequired) {
              requiredCount += 1;
            } else if (
              signatures.length - requiredCount >=
              this.multisigInfo.flexibleThreshold
            ) {
              // Too many flexible signatures
              if (!isSelfRequired) {
                return;
              }
              continue;
            }

            signatures.push(signature);
            if (signatures.length >= this.multisigInfo.threshold) {
              // Too many signatures and the flexible detect doesn't work. Only happens if all signatures are required.
              return;
            }
          }
          // === This signature is required or it's flexible but we don't have enough flexible signatures ===

          signatures.push(signMessageSecp256k1(info.message, this.privateKey));
          witness.signatures = signatures;
        },
      );
    }

    return tx;
  }
}
