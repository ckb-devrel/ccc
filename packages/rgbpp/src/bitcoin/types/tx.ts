// Read more about the available address types:
// - P2WPKH: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#p2wpkh
// - P2TR: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
export enum AddressType {
  P2PKH,
  P2WPKH,
  P2TR,
  P2SH_P2WPKH,
  P2WSH,
  P2SH,
  UNKNOWN,
}

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

export interface BtcApiRecommendedFeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BtcApiTransaction {
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

export interface BtcApiTransactionHex {
  hex: string;
}

export interface BtcApiUtxo {
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

export interface BtcApiUtxoParams {
  only_non_rgbpp_utxos?: boolean;
  only_confirmed?: boolean;
  min_satoshi?: number;
  no_cache?: boolean;
}

export interface BtcApiRecommendedFeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BtcApiSentTransaction {
  txid: string;
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
