import { Address } from "../../address/index.js";
import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Transaction, TransactionLike, WitnessArgs } from "../../ckb/index.js";
import { Client, KnownScript } from "../../client/index.js";
import { HexLike, hexFrom } from "../../hex/index.js";
import { numToBytes } from "../../num/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";
import { btcEcdsaPublicKeyHash } from "./verify.js";

/**
 * An abstract class extending the Signer class for Bitcoin-like signing operations.
 * This class provides methods to get Bitcoin account, public key, and internal address,
 * as well as signing transactions.
 * @public
 */
export abstract class SignerBtc extends Signer {
  constructor(client: Client) {
    super(client);
  }

  get type(): SignerType {
    return SignerType.BTC;
  }

  get signType(): SignerSignType {
    return SignerSignType.BtcEcdsa;
  }

  /**
   * Gets the Bitcoin account associated with the signer.
   *
   * @returns A promise that resolves to a string representing the Bitcoin account.
   */
  abstract getBtcAccount(): Promise<string>;

  /**
   * Gets the Bitcoin public key associated with the signer.
   *
   * @returns A promise that resolves to a HexLike value representing the Bitcoin public key.
   */
  abstract getBtcPublicKey(): Promise<HexLike>;

  /**
   * Gets the internal address, which is the Bitcoin account in this case.
   *
   * @returns A promise that resolves to a string representing the internal address.
   */
  async getInternalAddress(): Promise<string> {
    return this.getBtcAccount();
  }

  /**
   * Gets the identity, which is the Bitcoin public key in this case.
   *
   * @returns A promise that resolves to a string representing the identity
   */
  async getIdentity(): Promise<string> {
    return hexFrom(await this.getBtcPublicKey()).slice(2);
  }

  /**
   * Gets an array of Address objects representing the known script addresses for the signer.
   *
   * @returns A promise that resolves to an array of Address objects.
   */
  async getAddressObjs(): Promise<Address[]> {
    const publicKey = await this.getBtcPublicKey();
    const hash = btcEcdsaPublicKeyHash(publicKey);

    return [
      await Address.fromKnownScript(
        this.client,
        KnownScript.OmniLock,
        hexFrom([0x04, ...hash, 0x00]),
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
      await this.signMessageRaw(
        `CKB (Bitcoin Layer) transaction: ${info.message}`,
      ),
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

  abstract signPsbt(psbtHex: string): Promise<string>;

  abstract pushPsbt(psbtHex: string): Promise<string>;
}
