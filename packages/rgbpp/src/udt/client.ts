import { ccc } from "@ckb-ccc/core";

import { UtxoSeal } from "../bitcoin/transaction/index.js";
import { RgbppInvalidLockError, RgbppValidationError } from "../error.js";
import {
  IScriptProvider,
  isUsingOneOfScripts,
  RGBPP_BTC_TX_ID_PLACEHOLDER,
  RgbppScriptName,
  ScriptManager,
  updateScriptArgsWithTxId,
} from "../script/index.js";

export class RgbppUdtClient {
  public scriptManager: ScriptManager;

  constructor(
    private ckbClient: ccc.Client,
    scriptProvider: IScriptProvider,
  ) {
    this.scriptManager = new ScriptManager(scriptProvider);
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
      RGBPP_BTC_TX_ID_PLACEHOLDER,
      confirmations,
    );
  }

  async getRgbppScriptInfos(): Promise<
    Record<RgbppScriptName, ccc.ScriptInfo>
  > {
    return this.scriptManager.getRgbppScriptInfos();
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
}
