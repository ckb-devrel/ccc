import { ccc } from "@ckb-ccc/shell";

import { DEFAULT_CONFIRMATIONS } from "../constants/index.js";
import { UtxoSeal } from "../types/rgbpp/rgbpp.js";
import {
  CellDepSet,
  PredefinedScriptName,
  ScriptSet,
} from "../types/script.js";
import {
  buildBtcTimeLockArgs,
  buildRgbppLockArgs,
  buildUniqueTypeArgs,
  pseudoRgbppLockArgs,
} from "../utils/rgbpp.js";

export class ScriptManager {
  constructor(
    private scripts: ScriptSet,
    private cellDeps: CellDepSet,
  ) {}

  getScripts() {
    return JSON.parse(JSON.stringify(this.scripts));
  }

  getScriptInfos() {
    return Object.entries(this.scripts).reduce(
      (acc, [name, script]) => ({
        ...acc,
        [name]: {
          script,
          cellDep: this.cellDeps[name as PredefinedScriptName],
        },
      }),
      {} as Record<
        PredefinedScriptName,
        { script: ccc.Script; cellDep: ccc.CellDep }
      >,
    );
  }

  getScriptInfoByName(name: PredefinedScriptName): {
    script: ccc.Script;
    cellDep: ccc.CellDep;
  } {
    return {
      script: this.scripts[name],
      cellDep: this.cellDeps[name],
    };
  }

  buildPseudoRgbppLockScript(): ccc.Script {
    return ccc.Script.from({
      ...this.scripts[PredefinedScriptName.RgbppLock],
      args: pseudoRgbppLockArgs(),
    });
  }

  buildRgbppLockScript(utxoSeal: UtxoSeal): ccc.Script {
    return ccc.Script.from({
      ...this.scripts[PredefinedScriptName.RgbppLock],
      args: buildRgbppLockArgs({
        txId: utxoSeal.txId,
        index: utxoSeal.index, // index in btc tx output
      }),
    });
  }

  buildBtcTimeLockScript(
    receiverLock: ccc.Script,
    btcTxId: string,
    confirmations = DEFAULT_CONFIRMATIONS,
  ): ccc.Script {
    return ccc.Script.from({
      ...this.scripts[PredefinedScriptName.BtcTimeLock],
      args: buildBtcTimeLockArgs(receiverLock, btcTxId, confirmations),
    });
  }

  /* 
  https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md#type-id

  There are two ways to create a new cell with a specific type id.

    1. Create a transaction which uses any out point as tx.inputs[0] and has a output cell whose type script is Type ID. The output cell's type script args is the hash of tx.inputs[0] and its output index. Because any out point can only be used once as an input, tx.inputs[0] and thus the new type id must be different in each creation transaction.
    2. Destroy an old cell with a specific type id and create a new cell with the same type id in the same transaction.
  */
  buildUniqueTypeScript(
    firstInput: ccc.CellInput,
    outputIndex: number,
  ): ccc.Script {
    return ccc.Script.from({
      ...this.scripts[PredefinedScriptName.UniqueType],
      args: buildUniqueTypeArgs(firstInput, outputIndex),
    });
  }
}
