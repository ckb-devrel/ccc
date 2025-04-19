import { ccc } from "@ckb-ccc/shell";

import {
  CellDepSet,
  PredefinedScriptName,
  ScriptSet,
} from "../../types/script.js";

export const testnet3Scripts: ScriptSet = {
  [PredefinedScriptName.RgbppLock]: ccc.Script.from({
    codeHash:
      "0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248",
    hashType: "type",
    args: "",
  }),
  [PredefinedScriptName.BtcTimeLock]: ccc.Script.from({
    codeHash:
      "0x00cdf8fab0f8ac638758ebf5ea5e4052b1d71e8a77b9f43139718621f6849326",
    hashType: "type",
    args: "",
  }),

  [ccc.KnownScript.UniqueType]: ccc.Script.from({
    codeHash:
      "0x8e341bcfec6393dcd41e635733ff2dca00a6af546949f70c57a706c0f344df8b",
    hashType: "type",
    args: "",
  }),
};

export const testnet3CellDeps: CellDepSet = {
  [PredefinedScriptName.RgbppLock]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0xf1de59e973b85791ec32debbba08dff80c63197e895eb95d67fc1e9f6b413e00",
      index: "0x0",
    },
    depType: "code",
  }),
  [PredefinedScriptName.BtcTimeLock]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0xde0f87878a97500f549418e5d46d2f7704c565a262aa17036c9c1c13ad638529",
      index: "0x0",
    },
    depType: "code",
  }),

  [ccc.KnownScript.UniqueType]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0xff91b063c78ed06f10a1ed436122bd7d671f9a72ef5f5fa28d05252c17cf4cef",
      index: "0x0",
    },
    depType: "code",
  }),
};
