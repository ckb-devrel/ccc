import { ccc } from "@ckb-ccc/shell";

export enum PredefinedScriptName {
  RgbppLock = "RgbppLock",
  BtcTimeLock = "BtcTimeLock",
  UniqueType = ccc.KnownScript.UniqueType,
}

export interface ScriptSet {
  [PredefinedScriptName.RgbppLock]: ccc.Script;
  [PredefinedScriptName.BtcTimeLock]: ccc.Script;
  [PredefinedScriptName.UniqueType]: ccc.Script;
}

export interface CellDepSet {
  [PredefinedScriptName.RgbppLock]: ccc.CellDep;
  [PredefinedScriptName.BtcTimeLock]: ccc.CellDep;
  [PredefinedScriptName.UniqueType]: ccc.CellDep;
}
