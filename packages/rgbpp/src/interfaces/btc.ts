import { ccc } from "@ckb-ccc/core";

export interface SimpleBtcClient {
  getTransactionHex(txId: string): Promise<string>;

  getRgbppCellOutputs(btcAddress: string): Promise<ccc.CellOutput[]>;
}
