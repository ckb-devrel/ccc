import { ccc } from "@ckb-ccc/core";

import { TX_ID_PLACEHOLDER } from "../bitcoin/constants/index.js";

import { ScriptManager } from "../bitcoin/configs/script-manager.js";
import { NetworkConfig } from "../bitcoin/types/network.js";
import { UtxoSeal } from "../bitcoin/types/rgbpp/rgbpp.js";
import { RgbppUdtIssuance } from "../bitcoin/types/rgbpp/udt.js";
import { IScriptProvider, RgbppScriptName } from "../bitcoin/types/script.js";
import {
  isUsingOneOfScripts,
  updateScriptArgsWithTxId,
} from "../utils/script.js";
import { RgbppInvalidLockError, RgbppValidationError } from "./error.js";
import { RgbppUdtIssuanceService } from "./issuance.js";

export class RgbppUdtClient {
  public scriptManager: ScriptManager;
  private issuanceService: RgbppUdtIssuanceService;

  constructor(
    _networkConfig: NetworkConfig,
    private ckbClient: ccc.Client,
    scriptProvider: IScriptProvider,
  ) {
    this.scriptManager = new ScriptManager(scriptProvider);
    this.issuanceService = new RgbppUdtIssuanceService(this.scriptManager);
  }

  async rgbppLockScriptTemplate(): Promise<ccc.Script> {
    return this.scriptManager.rgbppLockScriptTemplate();
  }

  async btcTimeLockScriptTemplate(): Promise<ccc.Script> {
    return this.scriptManager.btcTimeLockScriptTemplate();
  }

  async buildRgbppLockScript(utxoSeal: UtxoSeal): Promise<ccc.Script> {
    return this.scriptManager.buildRgbppLockScript(utxoSeal);
  }

  async buildPseudoRgbppLockScript(): Promise<ccc.Script> {
    return this.scriptManager.buildPseudoRgbppLockScript();
  }

  async buildBtcTimeLockScript(
    ckbAddress: string,
    confirmations?: number,
  ): Promise<ccc.Script> {
    const receiverLock = (
      await ccc.Address.fromString(ckbAddress, this.ckbClient)
    ).script;

    return this.scriptManager.buildBtcTimeLockScript(
      receiverLock,
      TX_ID_PLACEHOLDER,
      confirmations,
    );
  }

  async getRgbppScriptInfos(): Promise<
    Record<RgbppScriptName, ccc.ScriptInfo>
  > {
    const [rgbppLock, btcTimeLock, uniqueType] = await Promise.all([
      this.scriptManager.getKnownScriptInfo(ccc.KnownScript.RgbppLock),
      this.scriptManager.getKnownScriptInfo(ccc.KnownScript.BtcTimeLock),
      this.scriptManager.getKnownScriptInfo(ccc.KnownScript.UniqueType),
    ]);

    return {
      [ccc.KnownScript.RgbppLock]: rgbppLock,
      [ccc.KnownScript.BtcTimeLock]: btcTimeLock,
      [ccc.KnownScript.UniqueType]: uniqueType,
    } as Record<RgbppScriptName, ccc.ScriptInfo>;
  }

  // * It's assumed that all the tx.outputs are rgbpp/btc time lock scripts.
  injectTxIdToRgbppCkbTx = async (
    tx: ccc.Transaction,
    txId: string,
  ): Promise<ccc.Transaction> => {
    const rgbppLockTemplate = await this.rgbppLockScriptTemplate();
    const btcTimeLockTemplate = await this.btcTimeLockScriptTemplate();

    const outputs = tx.outputs.map((output, _index) => {
      if (
        !isUsingOneOfScripts(output.lock, [
          rgbppLockTemplate,
          btcTimeLockTemplate,
        ])
      ) {
        throw new RgbppInvalidLockError(
          ["rgbpp", "btc time lock"],
          output.lock.codeHash,
        );
      }

      return ccc.CellOutput.from({
        ...output,
        lock: {
          ...output.lock,
          args: updateScriptArgsWithTxId(output.lock.args, txId),
        },
      });
    });

    return ccc.Transaction.from({
      ...tx,
      outputs,
    });
  };

  async createRgbppUdtIssuanceCells(
    signer: ccc.Signer,
    utxoSeal: UtxoSeal,
  ): Promise<ccc.Cell[]> {
    const rgbppLockScript = await this.buildRgbppLockScript(utxoSeal);

    const rgbppCellsGen = signer.client.findCellsByLock(rgbppLockScript);
    const rgbppCells: ccc.Cell[] = [];
    for await (const cell of rgbppCellsGen) {
      rgbppCells.push(cell);
    }

    if (rgbppCells.length !== 0) {
      return rgbppCells;
    }

    const tx = ccc.Transaction.default();

    // If additional capacity is required when used as an input in a transaction, it can always be supplemented in `completeInputsByCapacity`.
    tx.addOutput({
      lock: rgbppLockScript,
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
    const txHash = await signer.sendTransaction(tx);
    await signer.client.waitTransaction(txHash);

    const cell = await signer.client.getCellLive({
      txHash,
      index: 0,
    });
    if (!cell) {
      throw new RgbppValidationError("Cell not found after issuance");
    }

    return [cell];
  }

  async issuanceCkbPartialTx(
    params: RgbppUdtIssuance,
  ): Promise<ccc.Transaction> {
    return this.issuanceService.buildIssuanceCkbPartialTx(
      params,
      this.ckbClient,
    );
  }
}
