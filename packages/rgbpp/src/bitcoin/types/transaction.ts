import { AddressType } from "./address.js";

export interface BaseOutput {
  txid: string;
  vout: number;
}

export interface Output extends BaseOutput {
  value: number;
  scriptPk: string;
}

export interface Utxo extends Output {
  addressType: AddressType;
  address: string;
  pubkey?: string;
}

export interface BtcApiUtxoParams {
  only_non_rgbpp_utxos?: boolean;
  only_confirmed?: boolean;
  min_satoshi?: number;
  no_cache?: boolean;
}

export interface BtcApiBalanceParams {
  min_satoshi?: number;
  no_cache?: boolean;
}

export interface TxInputData {
  hash: string;
  index: number;
  witnessUtxo: { value: number; script: Buffer };
  tapInternalKey?: Buffer;
}

export type TxOutput = TxAddressOutput | TxScriptOutput;

export interface TxBaseOutput {
  value: number;
  fixed?: boolean;
  protected?: boolean;
  minUtxoSatoshi?: number;
}

export interface TxAddressOutput extends TxBaseOutput {
  address: string;
}

export interface TxScriptOutput extends TxBaseOutput {
  script: Buffer;
}

export type InitOutput = TxAddressOutput | TxDataOutput | TxScriptOutput;

export interface TxDataOutput extends TxBaseOutput {
  data: Buffer | string;
}

export interface UtxoSealOptions {
  targetValue?: number;
  feeRate?: number;
  btcUtxoParams?: BtcApiUtxoParams;
  /** Polling interval in milliseconds for waiting transaction confirmation (default: 30000) */
  confirmationPollInterval?: number;
}
