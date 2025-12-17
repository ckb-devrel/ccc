import { ccc } from "@ckb-ccc/core";

import { DEFAULT_CONFIRMATIONS } from "../constants/index.js";
import { UtxoSeal } from "../types/rgbpp/rgbpp.js";
import {
  buildBtcTimeLockArgs,
  buildRgbppLockArgs,
  buildUniqueTypeArgs,
  pseudoRgbppLockArgs,
} from "../utils/rgbpp.js";

export class ScriptManager {
  private scriptCache: Map<ccc.KnownScript, Promise<ccc.ScriptInfo>> = new Map();

  constructor(
    private client: ccc.Client,
  ) {}

  /**
   * Get script info by name, using ccc.KnownScript
   */
  async getKnownScriptInfo(name: ccc.KnownScript): Promise<{
    script: ccc.Script;
    cellDep: ccc.CellDep;
  }> {
    let scriptInfoPromise = this.scriptCache.get(name);
    if (!scriptInfoPromise) {
      scriptInfoPromise = this.client.getKnownScript(name);
      this.scriptCache.set(name, scriptInfoPromise);
    }

    const scriptInfo = await scriptInfoPromise;

    return {
      script: ccc.Script.from({
        codeHash: scriptInfo.codeHash,
        hashType: scriptInfo.hashType,
        args: "",
      }),
      cellDep: scriptInfo.cellDeps[0].cellDep,
    };
  }

  async buildPseudoRgbppLockScript(): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return ccc.Script.from({
      ...script,
      args: pseudoRgbppLockArgs(),
    });
  }

  async buildRgbppLockScript(utxoSeal: UtxoSeal): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return ccc.Script.from({
      ...script,
      args: buildRgbppLockArgs({
        txId: utxoSeal.txId,
        index: utxoSeal.index, // index in btc tx output
      }),
    });
  }

  async buildBtcTimeLockScript(
    receiverLock: ccc.Script,
    btcTxId: string,
    confirmations = DEFAULT_CONFIRMATIONS,
  ): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.BtcTimeLock);
    return ccc.Script.from({
      ...script,
      args: buildBtcTimeLockArgs(receiverLock, btcTxId, confirmations),
    });
  }

  /* 
  https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md#type-id

  There are two ways to create a new cell with a specific type id.

    1. Create a transaction which uses any out point as tx.inputs[0] and has a output cell whose type script is Type ID. The output cell's type script args is the hash of tx.inputs[0] and its output index. Because any out point can only be used once as an input, tx.inputs[0] and thus the new type id must be different in each creation transaction.
    2. Destroy an old cell with a specific type id and create a new cell with the same type id in the same transaction.
  */
  async buildUniqueTypeScript(
    firstInput: ccc.CellInput,
    outputIndex: number,
  ): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.UniqueType);
    return ccc.Script.from({
      ...script,
      args: buildUniqueTypeArgs(firstInput, outputIndex),
    });
  }

  /**
   * Get RGB++ lock script template (without args)
   */
  async rgbppLockScriptTemplate(): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return script;
  }

  /**
   * Get BTC time lock script template (without args)
   */
  async btcTimeLockScriptTemplate(): Promise<ccc.Script> {
    const { script } = await this.getKnownScriptInfo(ccc.KnownScript.BtcTimeLock);
    return script;
  }
}
