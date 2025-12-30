import { ccc } from "@ckb-ccc/core";

import {
  buildBtcTimeLockArgs,
  buildRgbppLockArgs,
  buildUniqueTypeArgs,
  pseudoRgbppLockArgs,
} from "../../utils/rgbpp.js";
import { DEFAULT_CONFIRMATIONS } from "../constants/index.js";
import { UtxoSeal } from "../types/rgbpp/rgbpp.js";
import { IScriptProvider, RgbppScriptName } from "../types/script.js";

/**
 * ScriptManager - Manages and builds RGB++ related scripts
 *
 * Uses IScriptProvider for flexible script source configuration.
 * Supports multiple script sources through provider composition.
 *
 * @example
 * ```typescript
 * import { ScriptManager, ClientScriptProvider } from "@ckb-ccc/rgbpp";
 *
 * // Basic usage with client
 * const manager = new ScriptManager(new ClientScriptProvider(client));
 *
 * // With custom scripts
 * const manager = new ScriptManager(
 *   createScriptProvider(client, customScripts)
 * );
 * ```
 */
export class ScriptManager {
  constructor(private provider: IScriptProvider) {}

  /**
   * Get script info by name using the configured provider
   *
   * @param name - Known script name from ccc.KnownScript
   * @returns ccc.ScriptInfo containing code hash, hash type, and cell dependencies
   */
  async getKnownScriptInfo(name: ccc.KnownScript): Promise<ccc.ScriptInfo> {
    return this.provider.getScriptInfo(name);
  }

  /**
   * Get all required RGBPP script infos in one call
   * This is a convenience method for initializing CkbRgbppUnlockSigner
   *
   * @returns Record containing RgbppLock, BtcTimeLock, and UniqueType script infos
   * @example
   * ```typescript
   * const scriptInfos = await scriptManager.getRgbppScriptInfos();
   * const signer = new CkbRgbppUnlockSigner({
   *   ckbClient,
   *   rgbppBtcAddress,
   *   btcDataSource,
   *   scriptInfos,
   * });
   * ```
   */
  async getRgbppScriptInfos(): Promise<
    Record<RgbppScriptName, ccc.ScriptInfo>
  > {
    const [rgbppLock, btcTimeLock, uniqueType] = await Promise.all([
      this.getKnownScriptInfo(ccc.KnownScript.RgbppLock),
      this.getKnownScriptInfo(ccc.KnownScript.BtcTimeLock),
      this.getKnownScriptInfo(ccc.KnownScript.UniqueType),
    ]);

    return {
      [ccc.KnownScript.RgbppLock]: rgbppLock,
      [ccc.KnownScript.BtcTimeLock]: btcTimeLock,
      [ccc.KnownScript.UniqueType]: uniqueType,
    };
  }

  async buildPseudoRgbppLockScript(): Promise<ccc.Script> {
    const scriptInfo = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
      args: pseudoRgbppLockArgs(),
    });
  }

  async buildRgbppLockScript(utxoSeal: UtxoSeal): Promise<ccc.Script> {
    const scriptInfo = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
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
    const scriptInfo = await this.getKnownScriptInfo(
      ccc.KnownScript.BtcTimeLock,
    );
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
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
    const scriptInfo = await this.getKnownScriptInfo(
      ccc.KnownScript.UniqueType,
    );
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
      args: buildUniqueTypeArgs(firstInput, outputIndex),
    });
  }

  /**
   * Get RGB++ lock script template (without args)
   */
  async rgbppLockScriptTemplate(): Promise<ccc.Script> {
    const scriptInfo = await this.getKnownScriptInfo(ccc.KnownScript.RgbppLock);
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
      args: "",
    });
  }

  /**
   * Get BTC time lock script template (without args)
   */
  async btcTimeLockScriptTemplate(): Promise<ccc.Script> {
    const scriptInfo = await this.getKnownScriptInfo(
      ccc.KnownScript.BtcTimeLock,
    );
    return ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
      args: "",
    });
  }
}
