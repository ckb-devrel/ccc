import { ccc } from "@ckb-ccc/shell";

import { UtxoSeal } from "../types/rgbpp/rgbpp.js";
import {
  prependHexPrefix,
  reverseHexByteOrder,
  trimHexPrefix,
} from "./encoder.js";

export const isSameScriptTemplate = (
  lock1: ccc.Script,
  lock2: ccc.Script,
): boolean => {
  return lock1.codeHash === lock2.codeHash && lock1.hashType === lock2.hashType;
};

export const isUsingOneOfScripts = (
  script: ccc.Script,
  scripts: ccc.Script[],
): boolean => {
  return (
    scripts.length > 0 && scripts.some((s) => isSameScriptTemplate(s, script))
  );
};

export const updateScriptArgsWithTxId = (
  args: ccc.Hex,
  txId: string,
): string => {
  const argsLength = trimHexPrefix(args).length;
  if (argsLength < (32 + 2) * 2) {
    throw new Error("Lock args length is invalid");
  }
  return prependHexPrefix(
    `${trimHexPrefix(args).substring(0, argsLength - 32 * 2)}${trimHexPrefix(
      reverseHexByteOrder(prependHexPrefix(txId)),
    )}`,
  );
};

export function getTxIdFromScriptArgs(args: ccc.Hex): string {
  if (args.length < 32 * 2) {
    throw new Error("Lock args length is invalid");
  }

  return trimHexPrefix(
    reverseHexByteOrder(args.substring(args.length - 32 * 2) as ccc.Hex),
  );
}

export function getTxIndexFromScriptArgs(args: ccc.Hex): number {
  if (args.length < 32 * 2) {
    throw new Error("Lock args length is invalid");
  }

  return parseInt(
    reverseHexByteOrder(trimHexPrefix(args.substring(0, 8)) as ccc.Hex),
    16,
  );
}

export function parseUtxoSealFromScriptArgs(args: ccc.Hex): UtxoSeal {
  return {
    txId: getTxIdFromScriptArgs(args),
    index: getTxIndexFromScriptArgs(args),
  };
}
