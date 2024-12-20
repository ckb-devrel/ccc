import bs58check from "bs58check";
import { Address } from "../../address/index.js";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Transaction, TransactionLike, WitnessArgs } from "../../ckb/index.js";
import { KnownScript } from "../../client/index.js";
import { hexFrom } from "../../hex/index.js";
import { numToBytes } from "../../num/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

/**
 * An abstract class extending the Signer class for Dogecoin-like signing operations.
 * This class provides methods to get Doge account, public key, and internal address,
 * as well as signing transactions.
 * @public
 */
export abstract class SignerDoge extends Signer {
  get type(): SignerType {
    return SignerType.Doge;
  }

  get signType(): SignerSignType {
    return SignerSignType.DogeEcdsa;
  }

  /**
   * Gets the Doge address associated with the signer.
   *
   * @returns A promise that resolves to a string representing the Doge account.
   */
  abstract getDogeAddress(): Promise<string>;

  /**
   * Gets the internal address, which is the Doge account in this case.
   *
   * @returns A promise that resolves to a string representing the internal address.
   */
  async getInternalAddress(): Promise<string> {
    return this.getDogeAddress();
  }

  /**
   * Gets the identity, which is the Doge address in this case.
   *
   * @returns A promise that resolves to a string representing the identity
   */
  async getIdentity(): Promise<string> {
    return this.getDogeAddress();
  }

  /**
   * Gets an array of Address objects representing the known script addresses for the signer.
   *
   * @returns A promise that resolves to an array of Address objects.
   */
  async getAddressObjs(): Promise<Address[]> {
    const hash = bs58check.decode(await this.getDogeAddress()).slice(1);

    return [
      await Address.fromKnownScript(
        this.client,
        KnownScript.OmniLock,
        hexFrom([0x05, ...hash, 0x00]),
      ),
    ];
  }

  /**
   * prepare a transaction before signing. This method is not implemented and should be overridden by subclasses.
   *
   * @param txLike - The transaction to prepare, represented as a TransactionLike object.
   * @returns A promise that resolves to the prepared Transaction object.
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    const { script } = await this.getRecommendedAddressObj();
    await tx.addCellDepsOfKnownScripts(this.client, KnownScript.OmniLock);
    await tx.prepareSighashAllWitness(script, 85, this.client);
    return tx;
  }

  /**
   * Signs a transaction without modifying it.
   *
   * @param txLike - The transaction to sign, represented as a TransactionLike object.
   * @returns A promise that resolves to a signed Transaction object.
   */
  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    const { script } = await this.getRecommendedAddressObj();
    const info = await tx.getSignHashInfo(script, this.client);
    if (!info) {
      return tx;
    }

    const signature = bytesFrom(
      await this.signMessageRaw(info.message.slice(2)),
      "base64",
    );
    signature[0] = 31 + ((signature[0] - 27) % 4);

    const witness = WitnessArgs.fromBytes(tx.witnesses[info.position]);
    witness.lock = hexFrom(
      bytesConcat(
        numToBytes(5 * 4 + signature.length, 4),
        numToBytes(4 * 4, 4),
        numToBytes(5 * 4 + signature.length, 4),
        numToBytes(5 * 4 + signature.length, 4),
        numToBytes(signature.length, 4),
        signature,
      ),
    );

    tx.setWitnessArgsAt(info.position, witness);
    return tx;
  }
}
