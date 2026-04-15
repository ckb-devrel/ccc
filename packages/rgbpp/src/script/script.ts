import { sha256 } from "@noble/hashes/sha2";

import { ccc, mol } from "@ckb-ccc/core";

import { UtxoSeal } from "../bitcoin/transaction/index.js";

/**
 * Required RGBPP scripts that must be provided
 * @public
 */
export const RGBPP_REQUIRED_SCRIPTS = [
  ccc.KnownScript.RgbppLock,
  ccc.KnownScript.BtcTimeLock,
  ccc.KnownScript.UniqueType,
] as const;

/**
 * Type representing the required RGBPP script names
 * @public
 */
export type RgbppScriptName = (typeof RGBPP_REQUIRED_SCRIPTS)[number];

// struct ExtraCommitmentData {
//   input_len: byte,
//   output_len: byte,
//  }

/**
 * @public
 */
export type ExtraCommitmentDataLike = {
  inputLen: ccc.NumLike;
  outputLen: ccc.NumLike;
};

@mol.codec(
  mol.struct({
    inputLen: mol.Uint8,
    outputLen: mol.Uint8,
  }),
)
export class ExtraCommitmentData extends mol.Entity.Base<
  ExtraCommitmentDataLike,
  ExtraCommitmentData
>() {
  constructor(
    public inputLen: ccc.Num,
    public outputLen: ccc.Num,
  ) {
    super();
  }

  static from(ec: ExtraCommitmentDataLike): ExtraCommitmentData {
    return new ExtraCommitmentData(
      ccc.numFrom(ec.inputLen),
      ccc.numFrom(ec.outputLen),
    );
  }
}

// table RGBPPUnlock {
//   version: Uint16,
//   extra_data: ExtraCommitmentData,
//   btc_tx: Bytes,
//   btc_tx_proof: Bytes,
// }

/**
 * @public
 */
export type RgbppUnlockLike = {
  version: ccc.NumLike;
  extraData: ExtraCommitmentDataLike;
  btcTx: ccc.HexLike;
  btcTxProof: ccc.HexLike;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    version: mol.Uint16,
    extraData: ExtraCommitmentData,
    btcTx: mol.Bytes,
    btcTxProof: mol.Bytes,
  }),
)
export class RgbppUnlock extends mol.Entity.Base<
  RgbppUnlockLike,
  RgbppUnlock
>() {
  constructor(
    public version: ccc.Num,
    public extraData: ExtraCommitmentData,
    public btcTx: ccc.Hex,
    public btcTxProof: ccc.Hex,
  ) {
    super();
  }

  static from(ru: RgbppUnlockLike): RgbppUnlock {
    return new RgbppUnlock(
      ccc.numFrom(ru.version),
      ExtraCommitmentData.from(ru.extraData),
      ccc.hexFrom(ru.btcTx),
      ccc.hexFrom(ru.btcTxProof),
    );
  }
}

// table BTCTimeLock {
//   lock_script: Script,
//   after: Uint32,
//   btc_txid: Byte32,
// }

/**
 * @public
 */
export type BtcTimeLockLike = {
  lockScript: ccc.Script;
  after: ccc.NumLike;
  btcTxid: ccc.HexLike;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    lockScript: ccc.Script,
    after: mol.Uint32,
    btcTxid: mol.Byte32,
  }),
)
export class BtcTimeLock extends mol.Entity.Base<
  BtcTimeLockLike,
  BtcTimeLock
>() {
  constructor(
    public lockScript: ccc.Script,
    public after: ccc.Num,
    public btcTxid: ccc.Hex,
  ) {
    super();
  }

  static from(btl: BtcTimeLockLike): BtcTimeLock {
    return new BtcTimeLock(
      ccc.Script.from(btl.lockScript),
      ccc.numFrom(btl.after),
      ccc.hexFrom(btl.btcTxid),
    );
  }
}

// table BTCTimeUnlock {
//   btc_tx_proof: Bytes,
// }

/**
 * @public
 */
export type BtcTimeUnlockLike = {
  btcTxProof: ccc.HexLike;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    btcTxProof: mol.Bytes,
  }),
)
export class BtcTimeUnlock extends mol.Entity.Base<
  BtcTimeUnlockLike,
  BtcTimeUnlock
>() {
  constructor(public btcTxProof: ccc.Hex) {
    super();
  }

  static from(btul: BtcTimeUnlockLike): BtcTimeUnlock {
    return new BtcTimeUnlock(ccc.hexFrom(btul.btcTxProof));
  }
}

// https://github.com/RGBPlusPlus/rgbpp/blob/main/contracts/rgbpp-lock/src/main.rs#L228
export const RGBPP_BTC_BLANK_TX_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const RGBPP_BTC_TX_ID_PLACEHOLDER_PRE_IMAGE =
  "sha256 this for easy replacement in spore co-build witness";
export const RGBPP_BTC_TX_ID_PLACEHOLDER = ccc.bytesTo(
  sha256(ccc.bytesFrom(RGBPP_BTC_TX_ID_PLACEHOLDER_PRE_IMAGE, "utf8")),
  "hex",
);

export const RGBPP_BTC_TX_PSEUDO_INDEX = 0xffffffff; // 4,294,967,295 (max u32)

export const RGBPP_BTC_TX_DEFAULT_CONFIRMATIONS = 6;

export const RGBPP_UNIQUE_TYPE_OUTPUT_INDEX = 1;

export const RGBPP_CONFIG_CELL_INDEX = 1;

export const deadLock = ccc.Script.from({
  codeHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  hashType: "data",
  args: "0x",
});

/**
 * https://learnmeabitcoin.com/technical/general/byte-order/
 * Whenever you're working with transaction/block hashes internally (e.g. inside raw bitcoin data), you use the natural byte order.
 * Whenever you're displaying or searching for transaction/block hashes, you use the reverse byte order.
 */
export const buildRgbppLockArgs = (utxoSeal: UtxoSeal): ccc.Hex => {
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.numLeToBytes(utxoSeal.vout, 4),
      ccc.bytesFrom(utxoSeal.txid).reverse(),
    ),
  );
};

export function pseudoRgbppLockArgs(): ccc.Hex {
  return buildRgbppLockArgs({
    txid: RGBPP_BTC_TX_ID_PLACEHOLDER,
    vout: RGBPP_BTC_TX_PSEUDO_INDEX,
  });
}

export function pseudoRgbppLockArgsForCommitment(index: number): ccc.Hex {
  return buildRgbppLockArgs({
    txid: RGBPP_BTC_BLANK_TX_ID,
    vout: index,
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
    txid: getTxIdFromRgbppLockArgs(args),
    vout: getTxIndexFromRgbppLockArgs(args),
  };
}

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

export function btcTxIdInReverseByteOrder(btcTxId: string): string {
  return ccc.bytesTo(ccc.bytesFrom(btcTxId).reverse(), "hex");
}
