import { ccc } from "@ckb-ccc/core";

import { RgbppScriptInfo, RgbppUdtToken } from "./rgbpp.js";

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
