import { ccc } from "@ckb-ccc/core";

import {
  TX_ID_PLACEHOLDER,
  UNIQUE_TYPE_OUTPUT_INDEX,
} from "../constants/index.js";

import { ScriptManager } from "../configs/index.js";
import { deadLock } from "../configs/scripts/index.js";
import { NetworkConfig, UtxoSeal } from "../types/index.js";
import { RgbppUdtIssuance } from "../types/rgbpp/udt.js";
import { IScriptProvider, RgbppScriptName } from "../types/script.js";
import {
  deduplicateByOutPoint,
  encodeRgbppUdtToken,
  isUsingOneOfScripts,
  u128ToLe,
  updateScriptArgsWithTxId,
} from "../utils/index.js";

export class RgbppUdtClient {
  public scriptManager: ScriptManager;

  constructor(
    _networkConfig: NetworkConfig,
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
    const rgbppLockScript = await this.buildRgbppLockScript(utxoSeal);

    const rgbppCellsGen = signer.client.findCellsByLock(rgbppLockScript);
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
    await Promise.all(
      rgpbbLiveCells.map(async (cell) => {
        const cellInput = ccc.CellInput.from({
          previousOutput: cell.outPoint,
        });
        await cellInput.completeExtraInfos(this.ckbClient);

        tx.inputs.push(cellInput);
      }),
    );

    const pseudoRgbppLock =
      await this.scriptManager.buildPseudoRgbppLockScript();
    const btcTimeLock = await this.scriptManager.buildBtcTimeLockScript(
      deadLock,
      TX_ID_PLACEHOLDER,
    );
    const uniqueType = await this.scriptManager.buildUniqueTypeScript(
      tx.inputs[0],
      UNIQUE_TYPE_OUTPUT_INDEX,
    );
    const uniqueTypeInfo = await this.scriptManager.getKnownScriptInfo(
      ccc.KnownScript.UniqueType,
    );

    tx.addOutput(
      {
        lock: pseudoRgbppLock,
        type: ccc.Script.from({
          codeHash: params.udtScriptInfo.codeHash,
          hashType: params.udtScriptInfo.hashType,
          args: params.rgbppLiveCells[0].cellOutput.lock.hash(), // unique ID of udt token
        }),
      },
      u128ToLe(params.amount * BigInt(10 ** params.token.decimal)),
    );

    tx.addOutput(
      {
        lock: btcTimeLock,
        type: uniqueType,
      },
      encodeRgbppUdtToken(params.token),
    );

    tx.addCellDeps(
      params.udtScriptInfo.cellDeps[0].cellDep,
      uniqueTypeInfo.cellDeps[0].cellDep,
    );

    return tx;
  }
}
