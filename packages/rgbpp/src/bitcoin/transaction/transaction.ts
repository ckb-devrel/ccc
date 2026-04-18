import * as bitcoin from "bitcoinjs-lib";
import lodash from "lodash";

import { ccc } from "@ckb-ccc/core";

import { isOpReturnScriptPubkey } from "./script.js";

export const BTC_DEFAULT_DUST_LIMIT = 546;

export const BTC_DEFAULT_FEE_RATE = 1;

export const BTC_DEFAULT_CONFIRMATIONS = 6;

export interface TxInputData {
  hash: string;
  index: number;
  witnessUtxo: { value: number; script: Uint8Array };
  tapInternalKey?: Uint8Array;
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
  script: Uint8Array;
}

export type InitOutput = TxAddressOutput | TxDataOutput | TxScriptOutput;

export interface TxDataOutput extends TxBaseOutput {
  data: Uint8Array | string;
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
  } else if ("address" in output || "script" in output) {
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

/**
 * Convert data to OP_RETURN script pubkey.
 * The data size should be ranged in 1 to 80 bytes.
 *
 * @example
 * const data = ccc.bytesFrom('01020304');
 * const scriptPk = dataToOpReturnScriptPubkey(data); // Uint8Array [0x6a, 0x04, 0x01, 0x02, 0x03, 0x04]
 * const scriptPkHex = ccc.bytesTo(scriptPk, 'hex'); // 6a0401020304
 */
export function dataToOpReturnScriptPubkey(
  data: Uint8Array | string,
): Uint8Array {
  if (typeof data === "string") {
    data = ccc.bytesFrom(data);
  }

  const payment = bitcoin.payments.embed({ data: [data] });
  if (!payment.output) {
    throw new Error("Failed to create OP_RETURN script. Data cannot be empty.");
  }
  return payment.output;
}

/**
 * Convert a bitcoin.Transaction to hex string.
 * Note if using for RGBPP proof, shouldn't set the "withWitness" param to "true".
 *
 * @param tx - The Bitcoin transaction object
 * @param withWitness - Whether to include witness data (default: false)
 * @returns Hex string of the transaction
 */
export function transactionToHex(
  tx: bitcoin.Transaction,
  withWitness: boolean = false,
): string {
  if (!withWitness) {
    const _tx = tx.clone();
    _tx.stripWitnesses();
    return _tx.toHex();
  }
  return tx.toHex();
}
