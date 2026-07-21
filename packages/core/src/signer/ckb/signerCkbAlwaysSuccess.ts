import { Address } from "../../address/index.js";
import { Transaction, TransactionLike } from "../../ckb/index.js";
import { Client, KnownScript } from "../../client/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

/**
 * A signer for the well-known always-success lock script.
 *
 * The always-success script does not require a signature, so signing a
 * transaction only needs to add its cell dependency.
 *
 * @public
 */
export class SignerCkbAlwaysSuccess extends Signer {
  get type(): SignerType {
    return SignerType.CKB;
  }

  get signType(): SignerSignType {
    return SignerSignType.Unknown;
  }

  /**
   * Creates an instance of SignerCkbAlwaysSuccess.
   *
   * @param client - The client instance used for communication and resolving
   * the always-success deployment.
   */
  constructor(client: Client) {
    super(client);
  }

  async connect(): Promise<void> {}

  async isConnected(): Promise<boolean> {
    return true;
  }

  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  /**
   * Gets the address of the always-success lock script.
   */
  async getAddressObjs(): Promise<Address[]> {
    return [
      await Address.fromKnownScript(
        this.client,
        KnownScript.AlwaysSuccess,
        "0x",
      ),
    ];
  }

  /**
   * Adds the always-success cell dependency to a transaction.
   */
  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    await tx.addCellDepsOfKnownScripts(this.client, KnownScript.AlwaysSuccess);
    return tx;
  }

  /**
   * The always-success script requires no signature.
   */
  async signOnlyTransaction(txLike: TransactionLike): Promise<Transaction> {
    return Transaction.from(txLike);
  }
}
