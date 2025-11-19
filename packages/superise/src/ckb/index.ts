import { ccc } from "@ckb-ccc/core";
import type SupeRISE from '@superise/bridge-api-types'

export class CkbSigner extends ccc.Signer {
  get type() {
    return ccc.SignerType.CKB;
  }

  get signType() {
    return ccc.SignerSignType.CkbSecp256k1;
  }

  private connectionStorageKey = "superise-ckb-connection";

  private connection?: SupeRISE.CkbConnection;

  private _uiMetadataMap: Record<string, SupeRISE.SignCkbHashAllMetadata> = {};

  constructor(
    private readonly bridge: SupeRISE.Bridge,
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
      this.connection = JSON.parse(connection) as SupeRISE.CkbConnection;
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
    const signMessage = `Nervos Message:${message}`;
    const sign = await this.bridge.signCkbMessage(signMessage);
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

  public setUiMetadataForTx(
    tx: ccc.TransactionLike,
    metadata: SupeRISE.SignCkbHashAllMetadata,
  ) {
    const txHash = ccc.Transaction.from(tx).hash();
    this._uiMetadataMap[txHash] = metadata;
  }

  private getUiMetadataFromTx(tx: ccc.TransactionLike) {
    const txHash = ccc.Transaction.from(tx).hash();
    const metadata = this._uiMetadataMap[txHash];
    delete this._uiMetadataMap[txHash];
    return metadata;
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
    const metadata = this.getUiMetadataFromTx(tx);

    const signatureCache = new Map<string, string>();

    for (const { script } of await this.getRelatedScripts(tx)) {
      const info = await tx.getSignHashInfo(script, this.client);
      if (!info) {
        return tx;
      }

      const { message, position } = info;

      let signature!: string;
      if (signatureCache.has(message)) {
        signature = signatureCache.get(message)!;
      } else {
        const sign = await this.bridge.signCkbHashAll(
          message.replace(/^0x/, ""),
          metadata,
        );
        signature = sign.signature;
        signatureCache.set(message, signature);
      }

      const witness =
        tx.getWitnessArgsAt(info.position) ?? ccc.WitnessArgs.from({});
      witness.lock = signature as ccc.Hex;
      tx.setWitnessArgsAt(position, witness);
    }

    return tx;
  }

  override async signTransaction(
    tx: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    const preparedTx = await this.prepareTransaction(tx);
    return this.signOnlyTransaction(preparedTx);
  }

  override async sendTransaction(tx: ccc.TransactionLike): Promise<ccc.Hex> {
    return this.client.sendTransaction(await this.signTransaction(tx));
  }
}
