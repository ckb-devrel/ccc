import { ccc } from "@ckb-ccc/core";

import { RgbppUdtToken, RgbppScriptInfo } from "./rgbpp.js";

export interface RgbppUdtIssuance {
  token: RgbppUdtToken;
  amount: bigint;
  rgbppLiveCells: ccc.Cell[];
  udtScriptInfo: RgbppScriptInfo;
}

export interface RgbppBtcReceiver {
  address: string;
  amount: bigint;
}
