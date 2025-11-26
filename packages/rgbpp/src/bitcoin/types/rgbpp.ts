import { ccc } from "@ckb-ccc/core";

import { RgbppUdtClient } from "../../udt/index.js";
import { BtcApiUtxoParams } from "./tx.js";

export interface RgbppBtcTxParams {
  ckbPartialTx: ccc.Transaction;
  ckbClient: ccc.Client;
  rgbppUdtClient: RgbppUdtClient;
  receiverBtcAddresses: string[];

  btcChangeAddress: string;
  btcUtxoParams?: BtcApiUtxoParams;

  feeRate?: number;
}
