import { ccc } from "@ckb-ccc/core";

import { RgbppUdtToken } from "./rgbpp.js";

export interface RgbppUdtIssuance {
  token: RgbppUdtToken;
  amount: bigint;
  rgbppLiveCells: ccc.Cell[];
  udtScriptInfo: ccc.ScriptInfo;
}

export interface RgbppBtcReceiver {
  address: string;
  amount: bigint;
}
