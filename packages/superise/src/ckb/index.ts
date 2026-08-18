import { ccc } from "@ckb-ccc/core";
import type { Bridge, CkbConnection } from "../advancedBarrel";

export class CkbSigner extends ccc.Signer {
  get type() {
    return ccc.SignerType.CKB;
  }

  get signType() {
    return ccc.SignerSignType.CkbSecp256k1;
  }

  private connectionStorageKey = "superise-ckb-connection";

  private connection?: CkbConnection;

  constructor(
    private readonly bridge: Bridge,
    client: ccc.Client,
  ) {
    super(client);
  }

  private saveConnection() {
    localStorage.setItem(
      this.connectionStorageKey,
      JSON.stringify(this.connection),
    );
  }

  private restoreConnection() {
    const connection = localStorage.getItem(this.connectionStorageKey);
    if (!connection) return;
    try {
      this.connection = JSON.parse(connection) as CkbConnection;
    } catch (error) {
      console.error("Failed to restore superise connection:", error);
    }
  }

  private async getConnection() {
    if (!this.connection) this.restoreConnection();
    if (!this.connection) throw new Error("Not connected");

    return this.connection;
  }

  async connect() {
    this.connection = await this.bridge.connectCkb();
    this.saveConnection();
  }

  async isConnected() {
    if (this.connection) return true;

    this.restoreConnection();
    return !!this.connection;
  }

  override async disconnect() {
    this.connection = undefined;
    localStorage.removeItem(this.connectionStorageKey);
  }

  override async getInternalAddress() {
    return (await this.getConnection()).address;
  }

  override async getIdentity() {
    return (await this.getConnection()).publicKey;
  }

  async getAddressObj() {
    return await ccc.Address.fromString(
      await this.getInternalAddress(),
      this.client,
    );
  }

  override async getAddressObjs() {
    return [await this.getAddressObj()];
  }

  override async signMessageRaw(message: string) {
    const sign = await this.bridge.signCkbMessage(message);
    return ccc.hexFrom(sign.signature);
  }

  async getRelatedScripts(
    txLike: ccc.TransactionLike,
  ): Promise<{ script: ccc.Script; cellDeps: ccc.CellDepInfo[] }[]> {
    const tx = ccc.Transaction.from(txLike);

    const addressObj = await this.getAddressObj();
    const acp = await ccc.Script.fromKnownScript(
      this.client,
      ccc.KnownScript.AnyoneCanPay,
      addressObj.script.args,
    );

    const scripts: { script: ccc.Script; cellDeps: ccc.CellDepInfo[] }[] = [];
    for (const input of tx.inputs) {
      const {
        cellOutput: { lock },
      } = await input.getCell(this.client);

      if (scripts.some(({ script }) => script.eq(lock))) {
        continue;
      }

      if (lock.eq(addressObj.script)) {
        scripts.push({
          script: lock,
          cellDeps: (
            await this.client.getKnownScript(ccc.KnownScript.Secp256k1Blake160)
          ).cellDeps,
        });
      } else if (
        lock.codeHash === acp.codeHash &&
        lock.hashType === acp.hashType &&
        lock.args.startsWith(acp.args)
      ) {
        scripts.push({
          script: lock,
          cellDeps: (
            await this.client.getKnownScript(ccc.KnownScript.AnyoneCanPay)
          ).cellDeps,
        });
      }
    }

    return scripts;
  }

  override async prepareTransaction(txLike: ccc.TransactionLike) {
    const tx = ccc.Transaction.from(txLike);

    const scripts = await this.getRelatedScripts(tx);

    await Promise.all(
      scripts.map(async ({ script, cellDeps }) => {
        await tx.prepareSighashAllWitness(script, 65, this.client);
        await tx.addCellDepInfos(this.client, cellDeps);
      }),
    );

    return tx;
  }

  override async signOnlyTransaction(txLike: ccc.TransactionLike) {
    const tx = ccc.Transaction.from(txLike);

    const witnessIndexes = await ccc.reduceAsync(
      await this.getRelatedScripts(tx),
      async (indexes, scriptInfo) => {
        const index = await tx.findInputIndexByLock(
          scriptInfo.script,
          this.client,
        );
        if (typeof index !== "number") return;

        indexes.push(index);
      },
      [] as number[],
    );

    const result = await this.bridge.signCkbTransaction(
      ccc.stringify(tx),
      witnessIndexes,
    );
    const signedTx = JSON.parse(
      result.signedTransaction,
    ) as ccc.TransactionLike;
    return ccc.Transaction.from(signedTx);
  }
}
