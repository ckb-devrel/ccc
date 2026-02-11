import { ccc } from "@ckb-ccc/core";
import { ScriptManager } from "../bitcoin/configs/script-manager.js";
import { deadLock } from "../bitcoin/configs/scripts/index.js";
import {
  TX_ID_PLACEHOLDER,
  UNIQUE_TYPE_OUTPUT_INDEX,
} from "../bitcoin/constants/index.js";
import { RgbppUdtIssuance } from "../bitcoin/types/rgbpp/udt.js";
import { deduplicateByOutPoint } from "../bitcoin/utils/common.js";
import { encodeRgbppUdtToken } from "../utils/rgbpp.js";
import { RgbppValidationError } from "./error.js";

export class RgbppUdtIssuanceService {
  constructor(private scriptManager: ScriptManager) {}

  async buildIssuanceCkbPartialTx(
    params: RgbppUdtIssuance,
    ckbClient: ccc.Client,
  ): Promise<ccc.Transaction> {
    if (params.rgbppLiveCells.length === 0) {
      throw new RgbppValidationError("rgbppLiveCells is empty");
    }

    const rgbppLiveCells = deduplicateByOutPoint(params.rgbppLiveCells);

    const tx = ccc.Transaction.default();
    await Promise.all(
      rgbppLiveCells.map(async (cell) => {
        const cellInput = ccc.CellInput.from({
          previousOutput: cell.outPoint,
        });
        await cellInput.completeExtraInfos(ckbClient);
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

    if (params.udtScriptInfo.cellDeps.length === 0) {
      throw new RgbppValidationError("udtScriptInfo.cellDeps is empty");
    }
    if (uniqueTypeInfo.cellDeps.length === 0) {
      throw new RgbppValidationError("uniqueTypeInfo.cellDeps is empty");
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
      ccc.numLeToBytes(params.amount * BigInt(10 ** params.token.decimal), 16),
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
