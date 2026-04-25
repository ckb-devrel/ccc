import { ccc } from "@ckb-ccc/core";

import lodash from "lodash";

import {
  AddressType,
  isSupportedAddressType,
  SUPPORTED_ADDRESS_TYPES,
} from "./address.js";
import { PublicKeyProvider, toXOnly } from "./public-key.js";
import {
  dataToOpReturnScriptPubkey,
  isOpReturnScriptPubkey,
} from "./script.js";

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

export const BTC_DEFAULT_DUST_LIMIT = 546;

/**
 * Convert UTXO to PSBT input data
 *
 * @param utxo - The UTXO to convert
 * @param publicKeyProvider - Optional provider to lookup public keys for P2TR addresses
 * @returns PSBT input data
 *
 * @throws Error if address type is unsupported or public key is missing for P2TR
 */
export async function utxoToInputData(
  utxo: Utxo,
  publicKeyProvider?: PublicKeyProvider,
): Promise<TxInputData> {
  if (!isSupportedAddressType(utxo.addressType)) {
    throw new Error(
      `Unsupported address type, only support ${SUPPORTED_ADDRESS_TYPES.join(
        ", ",
      )}`,
    );
  }

  if (utxo.addressType === AddressType.P2WPKH) {
    const data = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(ccc.bytesFrom(utxo.scriptPk)),
      },
    };
    return data;
  }

  if (utxo.addressType === AddressType.P2TR) {
    let pubkey = utxo.pubkey;

    if (!pubkey && publicKeyProvider) {
      pubkey = await publicKeyProvider.getPublicKey(
        utxo.address,
        utxo.addressType,
      );
    }

    if (!pubkey) {
      throw new Error(
        `Missing pubkey for P2TR address ${utxo.address}. ` +
          `Please provide a PublicKeyProvider or add pubkey to UTXO data.`,
      );
    }

    const data = {
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        value: utxo.value,
        script: Buffer.from(ccc.bytesFrom(utxo.scriptPk)),
      },
      tapInternalKey: toXOnly(Buffer.from(ccc.bytesFrom(pubkey))),
    };
    return data;
  }

  throw new Error("Unsupported address type");
}

export function convertToOutput(output: InitOutput): TxOutput {
  let result: TxOutput | undefined;

  if ("data" in output) {
    result = {
      script: dataToOpReturnScriptPubkey(output.data),
      value: output.value,
      fixed: output.fixed,
      protected: output.protected,
      minUtxoSatoshi: output.minUtxoSatoshi,
    };
  }
  if ("address" in output || "script" in output) {
    result = lodash.cloneDeep(output);
  }
  if (!result) {
    throw new Error("Unsupported output");
  }

  const minUtxoSatoshi = result.minUtxoSatoshi ?? BTC_DEFAULT_DUST_LIMIT;
  const isOpReturnOutput =
    "script" in result && isOpReturnScriptPubkey(result.script);
  if (!isOpReturnOutput && result.value < minUtxoSatoshi) {
    throw new Error(`value is less than minUtxoSatoshi (${minUtxoSatoshi})`);
  }

  return result;
}
