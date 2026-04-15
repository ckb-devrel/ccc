import { ccc } from "@ckb-ccc/core";

import { RgbppSpvProofProvider } from "./spv.js";

export interface BtcBalance {
  address: string;
  total_satoshi: number;
  pending_satoshi: number;
  available_satoshi: number;
  dust_satoshi: number;
  rgbpp_satoshi: number;
  utxo_count: number;
}

export interface BtcRecommendedFeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BtcTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
  }[];
  vout: {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
  }[];
  weight: number;
  size: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
}

export interface BtcTransactionHex {
  hex: string;
}

export interface BtcUtxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
}

export interface BtcSentTransaction {
  txid: string;
}

export interface BtcUtxoParams {
  only_non_rgbpp_utxos?: boolean;
  only_confirmed?: boolean;
  min_satoshi?: number;
  no_cache?: boolean;
}

export interface BtcBalanceParams {
  min_satoshi?: number;
  no_cache?: boolean;
}

export interface BtcDataProvider {
  getTransactionHex(txId: string): Promise<string>;
  getTransaction(txId: string): Promise<BtcTransaction>;
  getUtxos(address: string, params?: BtcUtxoParams): Promise<BtcUtxo[]>;
  getBalance(address: string, params?: BtcBalanceParams): Promise<BtcBalance>;
  getRecommendedFee(): Promise<BtcRecommendedFeeRates>;
  sendTransaction(txHex: string): Promise<string>;
}

export interface RgbppCkbCellProvider {
  getRgbppCellOutputs(btcAddress: string): Promise<ccc.CellOutput[]>;
}

export interface RgbppDataSource
  extends BtcDataProvider,
    RgbppCkbCellProvider,
    RgbppSpvProofProvider {}
