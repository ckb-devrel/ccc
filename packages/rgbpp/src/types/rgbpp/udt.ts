import { ccc } from "@ckb-ccc/shell";

import { RgbppUdtToken, ScriptInfo } from "./rgbpp.js";

export interface RgbppUdtIssuance {
  token: RgbppUdtToken;
  amount: bigint;
  rgbppLiveCells: ccc.Cell[];
  udtScriptInfo: ScriptInfo;
}

export interface RgbppBtcReceiver {
  address: string;
  amount: bigint;
}
