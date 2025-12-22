import { ccc } from "@ckb-ccc/core";
import { SpvProofProvider } from "./spv.js";

export interface SimpleBtcClient {
  getTransactionHex(txId: string): Promise<string>;

  getRgbppCellOutputs(btcAddress: string): Promise<ccc.CellOutput[]>;
}

export interface RgbppBtcDataSource extends SimpleBtcClient, SpvProofProvider {}
