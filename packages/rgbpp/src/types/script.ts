import { ccc } from "@ckb-ccc/core";

/**
 * Script provider interface
 * Implement this interface to provide custom script sources
 *
 * Returns ccc.ScriptInfo which contains the script's code hash, hash type, and cell dependencies.
 *
 * @public
 */
export interface IScriptProvider {
  getScriptInfo(name: ccc.KnownScript): Promise<ccc.ScriptInfo>;
}

/**
 * Required RGBPP scripts that must be provided
 * @public
 */
export const RGBPP_REQUIRED_SCRIPTS = [
  ccc.KnownScript.RgbppLock,
  ccc.KnownScript.BtcTimeLock,
  ccc.KnownScript.UniqueType,
] as const;

/**
 * Type representing the required RGBPP script names
 * @public
 */
export type RgbppScriptName = (typeof RGBPP_REQUIRED_SCRIPTS)[number];

// Legacy types (kept for compatibility)
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
