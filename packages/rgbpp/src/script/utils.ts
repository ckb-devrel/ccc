import { ccc } from "@ckb-ccc/core";

import {
  BtcTimeLock,
  RGBPP_BTC_BLANK_TX_ID,
  RGBPP_BTC_TX_DEFAULT_CONFIRMATIONS,
  RGBPP_BTC_TX_ID_PLACEHOLDER,
  RGBPP_BTC_TX_PSEUDO_INDEX,
  RgbppUnlock,
  UtxoSeal,
} from "./rgbpp.js";

/**
 * https://learnmeabitcoin.com/technical/general/byte-order/
 * Whenever you're working with transaction/block hashes internally (e.g. inside raw bitcoin data), you use the natural byte order.
 * Whenever you're displaying or searching for transaction/block hashes, you use the reverse byte order.
 */
export const buildRgbppLockArgs = (utxoSeal: UtxoSeal): ccc.Hex => {
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.numLeToBytes(utxoSeal.index, 4),
      ccc.bytesFrom(utxoSeal.txId).reverse(),
    ),
  );
};

export function pseudoRgbppLockArgs(): ccc.Hex {
  return buildRgbppLockArgs({
    txId: RGBPP_BTC_TX_ID_PLACEHOLDER,
    index: RGBPP_BTC_TX_PSEUDO_INDEX,
  });
}

export function pseudoRgbppLockArgsForCommitment(index: number): ccc.Hex {
  return buildRgbppLockArgs({
    txId: RGBPP_BTC_BLANK_TX_ID,
    index,
  });
}

export const buildBtcTimeLockArgs = (
  receiverLock: ccc.Script,
  btcTxId: string,
  confirmations = RGBPP_BTC_TX_DEFAULT_CONFIRMATIONS,
): ccc.Hex => {
  return ccc.hexFrom(
    BtcTimeLock.encode({
      lockScript: receiverLock,
      after: confirmations,
      btcTxid: ccc.hexFrom(ccc.bytesFrom(btcTxId).reverse()),
    }),
  );
};

export const buildUniqueTypeArgs = (
  firstInput: ccc.CellInput,
  firstOutputIndex: number,
) => {
  const input = ccc.bytesFrom(firstInput.toBytes());
  const s = new ccc.HasherCkb();
  s.update(input);
  s.update(ccc.numLeToBytes(firstOutputIndex, 8));
  return s.digest().slice(0, 42);
};

export const buildRgbppUnlock = (
  btcLikeTxBytes: string,
  btcLikeTxProof: ccc.Hex,
  inputLen: number,
  outputLen: number,
) => {
  return ccc.hexFrom(
    RgbppUnlock.encode({
      version: 0,
      extraData: {
        inputLen,
        outputLen,
      },
      btcTx: ccc.hexFrom(btcLikeTxBytes),
      btcTxProof: ccc.hexFrom(btcLikeTxProof),
    }),
  );
};

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

export function deduplicateByOutPoint<T extends { outPoint: ccc.OutPoint }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.outPoint.txHash}-${item.outPoint.index.toString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
