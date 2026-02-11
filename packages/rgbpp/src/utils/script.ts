import { ccc } from "@ckb-ccc/core";

import { UtxoSeal } from "../bitcoin/types/rgbpp/rgbpp.js";

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
  const argsBytes = ccc.bytesFrom(args);
  if (argsBytes.length < 32) {
    throw new Error("Lock args length is invalid");
  }
  const txIdBytes = ccc.bytesFrom(txId).reverse();
  const newArgs = ccc.bytesConcat(
    argsBytes.subarray(0, argsBytes.length - 32),
    txIdBytes,
  );
  return ccc.hexFrom(newArgs);
};

export function getTxIdFromRgbppLockArgs(args: ccc.Hex): string {
  const argsBytes = ccc.bytesFrom(args);
  if (argsBytes.length < 32) {
    throw new Error("Lock args length is invalid");
  }

  return ccc.bytesTo(
    argsBytes.subarray(argsBytes.length - 32).reverse(),
    "hex",
  );
}

export function getTxIndexFromRgbppLockArgs(args: ccc.Hex): number {
  const argsBytes = ccc.bytesFrom(args);
  if (argsBytes.length < 32) {
    throw new Error("Lock args length is invalid");
  }

  return Number(ccc.numLeFromBytes(argsBytes.subarray(0, 4)));
}

export function parseUtxoSealFromRgbppLockArgs(args: ccc.Hex): UtxoSeal {
  return {
    txId: getTxIdFromRgbppLockArgs(args),
    index: getTxIndexFromRgbppLockArgs(args),
  };
}
