import { ccc } from "@ckb-ccc/core";
import { Aggregator } from "@joyid/ckb";
import { DappRequestType, buildJoyIDURL } from "@joyid/common";
import { createPopup } from "../common/index.js";
import {
  Connection,
  ConnectionsRepo,
  ConnectionsRepoLocalStorage,
} from "../connectionsStorage/index.js";

/**
 * Class representing a CKB signer that extends Signer
 * @public
 */
export class CkbSigner extends ccc.Signer {
  /**
   * Gets the signer type.
   * @returns The type of the signer.
   */
  get type(): ccc.SignerType {
    return ccc.SignerType.CKB;
  }

  /**
   * Gets the sign type.
   * @returns The sign type.
   */
  get signType(): ccc.SignerSignType {
    return ccc.SignerSignType.JoyId;
  }

  private connection?: Connection;

  /**
   * Ensures that the signer is connected and returns the connection.
   * @throws Will throw an error if not connected.
   * @returns A promise that resolves to the current connection.
   */
  private async assertConnection(): Promise<Connection> {
    if (!(await this.isConnected()) || !this.connection) {
      throw new Error("Not connected");
    }

    return this.connection;
  }

  /**
   * Creates an instance of CkbSigner.
   * @param client - The client instance.
   * @param name - The name of the signer.
   * @param icon - The icon URL of the signer.
   * @param _appUri - The application URI.
   * @param _aggregatorUri - The aggregator URI.
   * @param connectionsRepo - The connections repository.
   */
  constructor(
    client: ccc.Client,
    private readonly name: string,
    private readonly icon: string,
    private readonly _appUri?: string,
    private readonly _aggregatorUri?: string,
    private readonly connectionsRepo: ConnectionsRepo = new ConnectionsRepoLocalStorage(),
  ) {
    super(client);
  }

  /**
   * Gets the configuration for JoyID.
   * @returns The configuration object.
   */
  private getConfig() {
    return {
      redirectURL: location.href,
      joyidAppURL:
        this._appUri ??
        (this.client.addressPrefix === "ckb"
          ? "https://app.joy.id"
          : "https://testnet.joyid.dev"),
      name: this.name,
      logo: this.icon,
    };
  }

  /**
   * Gets the aggregator URI.
   * @returns The aggregator URI.
   */
  private getAggregatorUri(): string {
    return (
      this._aggregatorUri ??
      (this.client.addressPrefix === "ckb"
        ? "https://cota.nervina.dev/mainnet-aggregator"
        : "https://cota.nervina.dev/aggregator")
    );
  }

  /**
   * Connects to the provider by requesting authentication.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    const config = this.getConfig();

    const res = await createPopup(buildJoyIDURL(config, "popup", "/auth"), {
      ...config,
      type: DappRequestType.Auth,
    });

    this.connection = {
      address: res.address,
      publicKey: ccc.hexFrom(res.pubkey),
      keyType: res.keyType,
    };
    await this.saveConnection();
  }

  async disconnect(): Promise<void> {
    await super.disconnect();

    this.connection = undefined;
    await this.saveConnection();
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    if (this.connection) {
      return true;
    }
    await this.restoreConnection();
    return this.connection !== undefined;
  }

  /**
   * Gets the internal address.
   * @returns A promise that resolves to the internal address.
   */
  async getInternalAddress(): Promise<string> {
    return (await this.assertConnection()).address;
  }

  /**
   * Gets the identity of the signer.
   * @returns A promise that resolves to the identity.
   */
  async getIdentity(): Promise<string> {
    const connection = await this.assertConnection();
    return JSON.stringify({
      keyType: connection.keyType,
      publicKey: connection.publicKey.slice(2),
    });
  }

  /**
   * Gets the address object.
   * @returns A promise that resolves to the address object.
   */
  async getAddressObj(): Promise<ccc.Address> {
    return await ccc.Address.fromString(
      await this.getInternalAddress(),
      this.client,
    );
  }

  /**
   * Gets the address objects.
   * @returns A promise that resolves to an array of address objects.
   */
  async getAddressObjs(): Promise<ccc.Address[]> {
    return [await this.getAddressObj()];
  }

  /**
   * Prepares a transaction.
   * @param txLike - The transaction-like object.
   * @returns A promise that resolves to the prepared transaction.
   */
  async prepareTransaction(
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    const tx = ccc.Transaction.from(txLike);
    await tx.addCellDepsOfKnownScripts(this.client, ccc.KnownScript.JoyId);
    const position = await tx.findInputIndexByLock(
      (await this.getAddressObj()).script,
      this.client,
    );
    if (position === undefined) {
      return tx;
    }

    const witness = tx.getWitnessArgsAt(position) ?? ccc.WitnessArgs.from({});
    witness.lock = ccc.hexFrom("00".repeat(1000));
    await this.prepareTransactionForSubKey(tx, witness);
    tx.setWitnessArgsAt(position, witness);

    return tx;
  }

  /**
   * Prepares a transaction for a sub key.
   * @param tx - The transaction object.
   * @param witness - The witness arguments.
   * @throws Will throw an error if no COTA cells are found for the sub key wallet.
   */
  private async prepareTransactionForSubKey(
    tx: ccc.Transaction,
    witness: ccc.WitnessArgs,
  ) {
    if (
      this.connection?.keyType !== "sub_key" ||
      (witness.outputType ?? "0x") !== "0x"
    ) {
      return;
    }

    const pubkeyHash = ccc.hashCkb(this.connection.publicKey).substring(0, 42);
    const lock = (await this.getAddressObj()).script;
    const aggregator = new Aggregator(this.getAggregatorUri());
    const { unlock_entry: unlockEntry } =
      await aggregator.generateSubkeyUnlockSmt({
        alg_index: 1,
        pubkey_hash: pubkeyHash,
        lock_script: ccc.hexFrom(lock.toBytes()),
      });
    witness.outputType = ccc.hexFrom(unlockEntry);

    const cotaDeps: ccc.CellDep[] = [];
    for await (const cell of this.client.findCellsByLock(
      lock,
      await ccc.Script.fromKnownScript(this.client, ccc.KnownScript.COTA, "0x"),
    )) {
      cotaDeps.push(
        ccc.CellDep.from({
          depType: "code",
          outPoint: cell.outPoint,
        }),
      );
    }

    if (cotaDeps.length === 0) {
      throw new Error("No COTA cells for sub key wallet");
    }

    tx.addCellDepsAtStart(cotaDeps);
  }

  /**
   * Signs a transaction.
   * @param txLike - The transaction-like object.
   * @returns A promise that resolves to the signed transaction.
   */
  async signOnlyTransaction(
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    const tx = ccc.Transaction.from(txLike);
    const { script } = await this.getAddressObj();
    const witnessIndexes = await ccc.reduceAsync(
      tx.inputs,
      async (acc, input, i) => {
        const { cellOutput } = await input.getCell(this.client);

        if (cellOutput.lock.eq(script)) {
          acc.push(i);
        }
      },
      [] as number[],
    );

    // Trim unnecessary fields to reduce tx size
    await tx.prepareSighashAllWitness(script, 0, this.client);
    tx.inputs.forEach((i) => {
      i.cellOutput = undefined;
      i.outputData = undefined;
    });

    const config = this.getConfig();
    const res = await createPopup(
      buildJoyIDURL(
        {
          ...config,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          tx: JSON.parse(tx.stringify()),
          signerAddress: (await this.assertConnection()).address,
          witnessIndexes,
        },
        "popup",
        "/sign-ckb-raw-tx",
      ),
      {
        ...config,
        type: DappRequestType.SignCkbRawTx,
      },
    );

    return ccc.Transaction.from(res.tx);
  }

  /**
   * Signs a raw message with the account.
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    const { address } = await this.assertConnection();

    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);

    const config = this.getConfig();
    const res = await createPopup(
      buildJoyIDURL(
        {
          ...config,
          challenge,
          isData: typeof message !== "string",
          address,
        },
        "popup",
        "/sign-message",
      ),
      { ...config, type: DappRequestType.SignMessage },
    );
    return JSON.stringify({
      signature: res.signature,
      alg: res.alg,
      message: res.message,
    });
  }

  /**
   * Saves the current connection.
   * @returns
   */
  private async saveConnection(): Promise<void> {
    return this.connectionsRepo.set(
      {
        uri: this.getConfig().joyidAppURL,
        addressType: "ckb",
      },
      this.connection,
    );
  }

  /**
   * Restores the previous connection.
   * @returns
   */
  private async restoreConnection(): Promise<void> {
    this.connection = await this.connectionsRepo.get({
      uri: this.getConfig().joyidAppURL,
      addressType: "ckb",
    });
  }
}
