// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;

export interface BaseApis {
  request<T>(route: string, options?: BaseApiRequestOptions): Promise<T>;
  post<T>(route: string, options?: BaseApiRequestOptions): Promise<T>;
}

export interface BaseApiRequestOptions extends RequestInit {
  params?: Json;
  method?: "GET" | "POST";
  requireToken?: boolean;
  allow404?: boolean;
}

export interface BtcAssetsApiToken {
  token: string;
}

export interface BtcAssetsApiContext {
  request: {
    url: string;
    body?: Json;
    params?: Json;
  };
  response: {
    status: number;
    data?: Json | string;
  };
}

export interface BtcApiBalance {
  address: string;
  total_satoshi: number;
  pending_satoshi: number;
  /** @deprecated Use available_satoshi instead */
  satoshi: number;
  available_satoshi: number;
  dust_satoshi: number;
  rgbpp_satoshi: number;
  utxo_count: number;
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

export interface BtcApiSentTransaction {
  txid: string;
}
