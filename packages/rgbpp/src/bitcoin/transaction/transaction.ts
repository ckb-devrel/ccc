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
 * const data = Buffer.from('01020304', 'hex');
 * const scriptPk = dataToOpReturnScriptPubkey(data); // <Buffer 6a 04 01 02 03 04>
 * const scriptPkHex = scriptPk.toString('hex'); // 6a0401020304
 */
export function dataToOpReturnScriptPubkey(data: Buffer | string): Buffer {
  if (typeof data === "string") {
    data = Buffer.from(ccc.bytesFrom(data));
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
 * Uses bitcoinjs-lib v6.1.6 internal API (__toBuffer) for non-witness serialization.
 * Version is pinned in package.json. If upgrading bitcoinjs-lib, verify this still works.
 */
export function transactionToHex(
  tx: bitcoin.Transaction,
  withWitness?: boolean,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (tx as any)["__toBuffer"] !== "function") {
    throw new Error(
      "bitcoinjs-lib internal API changed. " +
        "transactionToHex requires __toBuffer. Check bitcoinjs-lib version (expected 6.1.6).",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
  const buffer: Buffer = (tx as any)["__toBuffer"](
    undefined,
    undefined,
    withWitness ?? false,
  );
  return buffer.toString("hex");
}
