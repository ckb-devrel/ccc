import { ccc } from "@ckb-ccc/core";
import {
  TX_ID_PLACEHOLDER,
  UNIQUE_TYPE_OUTPUT_INDEX,
} from "../bitcoin/constants.js";
import { deduplicateByOutPoint } from "../bitcoin/utils/common.js";
import { deadLock } from "./constants.js";
import { RgbppValidationError } from "./error.js";
import { ScriptManager } from "./script-manager.js";
import { RgbppUdtIssuance } from "./types.js";
import { encodeRgbppUdtToken } from "./utils.js";

export class RgbppUdtIssuanceService {
  constructor(private scriptManager: ScriptManager) {}

  async buildIssuanceCkbPartialTx(
    params: RgbppUdtIssuance,
    ckbClient: ccc.Client,
  ): Promise<ccc.Transaction> {
    if (params.rgbppLiveCells.length === 0) {
      throw new RgbppValidationError("rgbppLiveCells is empty");
    }

    const rgbppLiveCells = deduplicateByOutPoint(
      [...params.rgbppLiveCells].sort((a, b) =>
        a.outPoint.txHash === b.outPoint.txHash
          ? Number(a.outPoint.index - b.outPoint.index)
          : a.outPoint.txHash < b.outPoint.txHash
            ? -1
            : 1,
      ),
    );

    const tx = ccc.Transaction.default();
    for (const cell of rgbppLiveCells) {
      const cellInput = ccc.CellInput.from({
        previousOutput: cell.outPoint,
      });
      await cellInput.completeExtraInfos(ckbClient);
      tx.inputs.push(cellInput);
    }

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

    if (params.udtScriptInfo.cellDeps.length === 0) {
      throw new RgbppValidationError("udtScriptInfo.cellDeps is empty");
    }
    if (uniqueTypeInfo.cellDeps.length === 0) {
      throw new RgbppValidationError("uniqueTypeInfo.cellDeps is empty");
    }

    if (
      !Number.isInteger(params.token.decimal) ||
      params.token.decimal < 0 ||
      params.token.decimal > 38
    ) {
      throw new RgbppValidationError(
        `Invalid token decimal: ${params.token.decimal}. Must be an integer between 0 and 38.`,
      );
    }

    const MAX_U128 = (1n << 128n) - 1n;
    const tokenAmount = params.amount * 10n ** BigInt(params.token.decimal);
    if (tokenAmount < 0n || tokenAmount > MAX_U128) {
      throw new RgbppValidationError(
        `Token amount ${tokenAmount} overflows 128-bit unsigned integer (max ${MAX_U128}).`,
      );
    }

    tx.addOutput(
      {
        lock: pseudoRgbppLock,
        type: ccc.Script.from({
          codeHash: params.udtScriptInfo.codeHash,
          hashType: params.udtScriptInfo.hashType,
          args: rgbppLiveCells[0].cellOutput.lock.hash(), // unique ID of udt token
        }),
      },
      ccc.numLeToBytes(tokenAmount, 16),
    );

    tx.addOutput(
      {
        lock: btcTimeLock,
        type: uniqueType,
      },
      encodeRgbppUdtToken(params.token),
    );

    tx.addCellDeps(
      ...params.udtScriptInfo.cellDeps.map((dep) => dep.cellDep),
      ...uniqueTypeInfo.cellDeps.map((dep) => dep.cellDep),
    );

    return tx;
  }
}
