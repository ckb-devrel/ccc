import { ccc } from "@ckb-ccc/core";

export interface RgbppUdtToken {
  decimal: number;
  name: string;
  symbol: string;
}

export interface RgbppUdtIssuance {
  token: RgbppUdtToken;
  amount: bigint;
  rgbppLiveCells: ccc.Cell[];
  udtScriptInfo: ccc.ScriptInfo;
}

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
