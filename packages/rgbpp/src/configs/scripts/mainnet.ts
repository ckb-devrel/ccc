import {
  CellDepSet,
  PredefinedScriptName,
  ScriptSet,
} from "../../types/script.js";

import { ccc } from "@ckb-ccc/core";

export const mainnetScripts: ScriptSet = {
  [PredefinedScriptName.RgbppLock]: ccc.Script.from({
    codeHash:
      "0xbc6c568a1a0d0a09f6844dc9d74ddb4343c32143ff25f727c59edf4fb72d6936",
    hashType: "type",
    args: "",
  }),
  [PredefinedScriptName.BtcTimeLock]: ccc.Script.from({
    codeHash:
      "0x70d64497a075bd651e98ac030455ea200637ee325a12ad08aff03f1a117e5a62",
    hashType: "type",
    args: "",
  }),
  [ccc.KnownScript.UniqueType]: ccc.Script.from({
    codeHash:
      "0x2c8c11c985da60b0a330c61a85507416d6382c130ba67f0c47ab071e00aec628",
    hashType: "data1",
    args: "",
  }),
};

export const mainnetCellDeps: CellDepSet = {
  [PredefinedScriptName.RgbppLock]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0x04c5c3e69f1aa6ee27fb9de3d15a81704e387ab3b453965adbe0b6ca343c6f41",
      index: "0x0",
    },
    depType: "code",
  }),
  [PredefinedScriptName.BtcTimeLock]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0x6257bf4297ee75fcebe2654d8c5f8d93bc9fc1b3dc62b8cef54ffe166162e996",
      index: "0x0",
    },
    depType: "code",
  }),
  [ccc.KnownScript.UniqueType]: ccc.CellDep.from({
    outPoint: {
      txHash:
        "0x67524c01c0cb5492e499c7c7e406f2f9d823e162d6b0cf432eacde0c9808c2ad",
      index: "0x0",
    },
    depType: "code",
  }),
};
