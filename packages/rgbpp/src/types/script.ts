import { ccc } from "@ckb-ccc/core";

export interface ScriptSet {
  [key: string]: ccc.Script;
  [ccc.KnownScript.RgbppLock]: ccc.Script;
  [ccc.KnownScript.BtcTimeLock]: ccc.Script;
  [ccc.KnownScript.UniqueType]: ccc.Script;
}

export interface CellDepSet {
  [key: string]: ccc.CellDep;
  [ccc.KnownScript.RgbppLock]: ccc.CellDep;
  [ccc.KnownScript.BtcTimeLock]: ccc.CellDep;
  [ccc.KnownScript.UniqueType]: ccc.CellDep;
}
