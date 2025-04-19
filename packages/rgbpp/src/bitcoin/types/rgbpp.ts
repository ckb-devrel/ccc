import { ccc } from "@ckb-ccc/shell";

import { RgbppUdtClient } from "../../udt/index.js";

export interface RgbppBtcTxParams {
  ckbPartialTx: ccc.Transaction;
  ckbClient: ccc.Client;
  rgbppUdtClient: RgbppUdtClient;
  receiverBtcAddresses: string[];

  btcChangeAddress: string;

  feeRate?: number;
}
