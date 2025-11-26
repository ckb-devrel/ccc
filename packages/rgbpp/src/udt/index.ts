import { ccc } from "@ckb-ccc/shell";

import {
  TX_ID_PLACEHOLDER,
  UNIQUE_TYPE_OUTPUT_INDEX,
} from "../constants/index.js";

import { ScriptManager } from "../configs/index.js";
import { deadLock } from "../configs/scripts/index.js";
import { NetworkConfig, UtxoSeal } from "../types/index.js";
import { RgbppUdtIssuance } from "../types/rgbpp/udt.js";
import { PredefinedScriptName } from "../types/script.js";
import {
  deduplicateByOutPoint,
  encodeRgbppUdtToken,
  isUsingOneOfScripts,
  u128ToLe,
  updateScriptArgsWithTxId,
} from "../utils/index.js";

export class RgbppUdtClient {
  private scriptManager: ScriptManager;

  constructor(
    networkConfig: NetworkConfig,
    private ckbClient: ccc.Client,
  ) {
    this.scriptManager = new ScriptManager(
      networkConfig.scripts,
      networkConfig.cellDeps,
    );
  }

  getRgbppScriptInfos() {
    return this.scriptManager.getScriptInfos();
  }

  getRgbppScriptInfoByName(name: PredefinedScriptName) {
    return this.scriptManager.getScriptInfoByName(name);
  }

  rgbppLockScriptTemplate() {
    return this.scriptManager.getScriptInfoByName(
      PredefinedScriptName.RgbppLock,
    ).script;
  }

  btcTimeLockScriptTemplate() {
    return this.scriptManager.getScriptInfoByName(
      PredefinedScriptName.BtcTimeLock,
    ).script;
  }

  buildRgbppLockScript(utxoSeal: UtxoSeal) {
    return this.scriptManager.buildRgbppLockScript(utxoSeal);
  }

  buildPseudoRgbppLockScript() {
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

  // * It's assumed that all the tx.outputs are rgbpp/btc time lock scripts.
  injectTxIdToRgbppCkbTx = (
    tx: ccc.Transaction,
    txId: string,
  ): ccc.Transaction => {
    const outputs = tx.outputs.map((output, index) => {
      if (
        !isUsingOneOfScripts(output.lock, [
          this.rgbppLockScriptTemplate(),
          this.btcTimeLockScriptTemplate(),
        ])
      ) {
        throw new Error(
          `Invalid output lock, expected one of rgbpp/btc time lock scripts, but got ${output.lock.codeHash}`,
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
    const rgbppLockScript = this.buildRgbppLockScript(utxoSeal);

    const rgbppCellsGen =
      await signer.client.findCellsByLock(rgbppLockScript);
    const rgbppCells: ccc.Cell[] = [];
    for await (const cell of rgbppCellsGen) {
      rgbppCells.push(cell);
    }

    if (rgbppCells.length !== 0) {
      console.log("Using existing RGB++ cell");
      return rgbppCells;
    }

    console.log("RGB++ cell not found, creating a new one");
    const tx = ccc.Transaction.default();

    // If additional capacity is required when used as an input in a transaction, it can always be supplemented in `completeInputsByCapacity`.
    tx.addOutput({
      lock: rgbppLockScript,
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
    const txHash = await signer.sendTransaction(tx);
    await signer.client.waitTransaction(txHash);
    console.log(`RGB++ cell created, txHash: ${txHash}`);

    const cell = await signer.client.getCellLive({
      txHash,
      index: 0,
    });
    if (!cell) {
      throw new Error("Cell not found");
    }

    return [cell];
  }

  async issuanceCkbPartialTx(
    params: RgbppUdtIssuance,
  ): Promise<ccc.Transaction> {
    if (params.rgbppLiveCells.length === 0) {
      throw new Error("rgbppLiveCells is empty");
    }

    const rgpbbLiveCells = deduplicateByOutPoint(params.rgbppLiveCells);

    const tx = ccc.Transaction.default();
    rgpbbLiveCells.forEach((cell) => {
      const cellInput = ccc.CellInput.from({
        previousOutput: cell.outPoint,
      });
      cellInput.completeExtraInfos(this.ckbClient);

      tx.inputs.push(cellInput);
    });

    tx.addOutput(
      {
        lock: this.scriptManager.buildPseudoRgbppLockScript(),
        type: ccc.Script.from({
          ...params.udtScriptInfo.script,
          args: params.rgbppLiveCells[0].cellOutput.lock.hash(), // unique ID of udt token
        }),
      },
      u128ToLe(params.amount * BigInt(10 ** params.token.decimal)),
    );

    tx.addOutput(
      {
        lock: this.scriptManager.buildBtcTimeLockScript(
          deadLock,
          TX_ID_PLACEHOLDER,
        ),
        type: this.scriptManager.buildUniqueTypeScript(
          tx.inputs[0],
          UNIQUE_TYPE_OUTPUT_INDEX,
        ),
      },
      encodeRgbppUdtToken(params.token),
    );

    tx.addCellDeps(
      params.udtScriptInfo.cellDep,
      this.scriptManager.getScriptInfoByName(PredefinedScriptName.UniqueType)
        .cellDep,
    );

    return tx;
  }
}
