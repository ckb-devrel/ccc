import { ccc } from "@ckb-ccc/shell";

import { BtcTimeLock, BtcTimeUnlock } from "../types/rgbpp/rgbpp.js";
import { prependHexPrefix, reverseHexByteOrder } from "./encoder.js";

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
  } = BtcTimeLock.decode(prependHexPrefix(args));

  return {
    lock: lockScript,
    confirmations: Number(confirmations),
    btcTxId: reverseHexByteOrder(prependHexPrefix(btcTxId)),
  };
};

export const buildBtcTimeUnlockWitness = (btcTxProof: string): ccc.Hex => {
  const btcTimeUnlock = BtcTimeUnlock.encode({ btcTxProof });

  return ccc.hexFrom(
    ccc.WitnessArgs.from({
      lock: prependHexPrefix(ccc.hexFrom(btcTimeUnlock)),
      inputType: "",
      outputType: "",
    }).toBytes(),
  );
};
