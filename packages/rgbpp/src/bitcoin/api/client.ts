import { ccc } from "@ckb-ccc/core";

import { RgbppBtcDataSource } from "../../interfaces/index.js";
import {
  BtcApiBalance,
  BtcApiBalanceParams,
  BtcApiRecommendedFeeRates,
  BtcApiSentTransaction,
  BtcApiTransaction,
  BtcApiTransactionHex,
  BtcApiUtxo,
  BtcApiUtxoParams,
  RgbppApiSpvProof,
} from "../types/index.js";

import { BtcAssetsApiBase } from "./base.js";

/**
 * Typed API client for Bitcoin and RGBPP endpoints.
 *
 * Encapsulates all endpoint URLs and response types in one place.
 * Consumers use typed methods instead of raw `request<T>(url)` calls.
 */
export class BtcApiClient implements RgbppBtcDataSource {
  constructor(private base: BtcAssetsApiBase) {}

  getTransaction(txId: string) {
    return this.base.request<BtcApiTransaction>(
      `/bitcoin/v1/transaction/${txId}`,
    );
  }

  async getTransactionHex(txId: string) {
    const { hex } = await this.base.request<BtcApiTransactionHex>(
      `/bitcoin/v1/transaction/${txId}/hex`,
    );
    return hex;
  }

  getUtxos(address: string, params?: BtcApiUtxoParams) {
    return this.base.request<BtcApiUtxo[]>(
      `/bitcoin/v1/address/${address}/unspent`,
      { params },
    );
  }

  getBalance(address: string, params?: BtcApiBalanceParams) {
    return this.base.request<BtcApiBalance>(
      `/bitcoin/v1/address/${address}/balance`,
      { params },
    );
  }

  getRecommendedFee() {
    return this.base.request<BtcApiRecommendedFeeRates>(
      `/bitcoin/v1/fees/recommended`,
    );
  }

  async sendTransaction(txHex: string): Promise<string> {
    const { txid: txId } = await this.base.post<BtcApiSentTransaction>(
      "/bitcoin/v1/transaction",
      {
        body: JSON.stringify({ txhex: txHex }),
      },
    );
    return txId;
  }

  async getRgbppSpvProof(btcTxId: string, confirmations: number) {
    const spvProof: RgbppApiSpvProof | null =
      await this.base.request<RgbppApiSpvProof>("/rgbpp/v1/btc-spv/proof", {
        params: {
          btc_txid: btcTxId,
          confirmations,
        },
      });

    return spvProof
      ? {
          proof: spvProof.proof as ccc.Hex,
          spvClientOutpoint: ccc.OutPoint.from({
            txHash: spvProof.spv_client.tx_hash,
            index: spvProof.spv_client.index,
          }),
        }
      : null;
  }

  async getRgbppCellOutputs(btcAddress: string) {
    const res = await this.base.request<{ cellOutput: ccc.CellOutput }[]>(
      `/rgbpp/v1/address/${btcAddress}/assets`,
    );
    return res.map((item: { cellOutput: ccc.CellOutput }) => item.cellOutput);
  }
}
