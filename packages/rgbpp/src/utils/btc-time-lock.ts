import { ccc } from "@ckb-ccc/core";

import { BtcTimeLock, BtcTimeUnlock } from "../bitcoin/types/index.js";
import { btcTxIdInReverseByteOrder } from "./rgbpp.js";

export const parseBtcTimeLockArgs = (
  args: string,
): {
  lock: ccc.Script;
  confirmations: number;
  btcTxId: string;
} => {
  const {
    lockScript,
    after: confirmations,
    btcTxid: btcTxId,
  } = BtcTimeLock.decode(ccc.hexFrom(args));

  return {
    lock: lockScript,
    confirmations: Number(confirmations),
    btcTxId: btcTxIdInReverseByteOrder(btcTxId),
  };
};

export const buildBtcTimeUnlockWitness = (btcTxProof: string): ccc.Hex => {
  const btcTimeUnlock = BtcTimeUnlock.encode({
    btcTxProof: ccc.hexFrom(btcTxProof),
  });

  return ccc.hexFrom(
    ccc.WitnessArgs.from({
      lock: ccc.hexFrom(btcTimeUnlock),
      inputType: "",
      outputType: "",
    }).toBytes(),
  );
};
