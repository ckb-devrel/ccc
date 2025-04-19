import { ccc } from "@ckb-ccc/shell";

export interface SimpleBtcClient {
  getTransactionHex(txId: string): Promise<string>;

  getRgbppCellOutputs(btcAddress: string): Promise<ccc.CellOutput[]>;
}
