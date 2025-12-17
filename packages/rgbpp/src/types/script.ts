import { ccc } from "@ckb-ccc/core";

/**
 * Script set for Bitcoin Signet network
 * Signet uses local configuration as it's primarily for testing
 */
export interface ScriptSet {
  [key: string]: ccc.Script;
  [ccc.KnownScript.RgbppLock]: ccc.Script;
  [ccc.KnownScript.BtcTimeLock]: ccc.Script;
  [ccc.KnownScript.UniqueType]: ccc.Script;
}

/**
 * Cell dep set for Bitcoin Signet network
 */
export interface CellDepSet {
  [key: string]: ccc.CellDep;
  [ccc.KnownScript.RgbppLock]: ccc.CellDep;
  [ccc.KnownScript.BtcTimeLock]: ccc.CellDep;
  [ccc.KnownScript.UniqueType]: ccc.CellDep;
}
