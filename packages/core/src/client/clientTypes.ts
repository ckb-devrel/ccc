import {
  Cell,
  CellDep,
  CellDepLike,
  Epoch,
  HashType,
  HashTypeLike,
  OutPoint,
  OutPointLike,
  Script,
  ScriptLike,
  Transaction,
  hashTypeFrom,
} from "../ckb/index.js";
import { Hex, HexLike, hexFrom } from "../hex/index.js";
import { Num, NumLike, numFrom } from "../num/index.js";
import { apply } from "../utils/index.js";
import {
  ClientCollectableSearchKeyFilterLike,
  ClientCollectableSearchKeyLike,
  clientSearchKeyRangeFrom,
} from "./clientTypes.advanced.js";

/**
 * @public
 */
export enum KnownScript {
  NervosDao = "NervosDao",
  Secp256k1Blake160 = "Secp256k1Blake160",
  Secp256k1Multisig = "Secp256k1Multisig",
  AnyoneCanPay = "AnyoneCanPay",
  TypeId = "TypeId",
  XUdt = "XUdt",
  JoyId = "JoyId",
  COTA = "COTA",
  PWLock = "PWLock",
  OmniLock = "OmniLock",
  NostrLock = "NostrLock",
  UniqueType = "UniqueType",

  // ckb-proxy-locks https://github.com/ckb-devrel/ckb-proxy-locks
  AlwaysSuccess = "AlwaysSuccess",
  InputTypeProxyLock = "InputTypeProxyLock",
  OutputTypeProxyLock = "OutputTypeProxyLock",
  LockProxyLock = "LockProxyLock",
  SingleUseLock = "SingleUseLock",
  TypeBurnLock = "TypeBurnLock",
  EasyToDiscoverType = "EasyToDiscoverType",
  TimeLock = "TimeLock",
}

/**
 * @public
 */
export type CellDepInfoLike = {
  cellDep: CellDepLike;
  type?: ScriptLike | null;
};

/**
 * @public
 */
export class CellDepInfo {
  constructor(
    public cellDep: CellDep,
    public type?: Script,
  ) {}

  static from(cellDepInfoLike: CellDepInfoLike): CellDepInfo {
    return new CellDepInfo(
      CellDep.from(cellDepInfoLike.cellDep),
      apply(Script.from, cellDepInfoLike.type),
    );
  }
}

/**
 * @public
 */
export type ScriptInfoLike = {
  codeHash: HexLike;
  hashType: HashTypeLike;
  cellDeps: CellDepInfoLike[];
};

/**
 * @public
 */
export class ScriptInfo {
  constructor(
    public codeHash: Hex,
    public hashType: HashType,
    public cellDeps: CellDepInfo[],
  ) {}

  static from(scriptInfoLike: ScriptInfoLike): ScriptInfo {
    return new ScriptInfo(
      hexFrom(scriptInfoLike.codeHash),
      hashTypeFrom(scriptInfoLike.hashType),
      scriptInfoLike.cellDeps.map((c) => CellDepInfo.from(c)),
    );
  }
}

/**
 * @public
 */
export type OutputsValidator = "passthrough" | "well_known_scripts_only";

/**
 * @public
 */
export type TransactionStatus =
  | "sent"
  | "pending"
  | "proposed"
  | "committed"
  | "unknown"
  | "rejected";
/**
 * @public
 */
export type ClientTransactionResponse = {
  transaction: Transaction;
  status: TransactionStatus;
  cycles?: Num;
  blockHash?: Hex;
  blockNumber?: Num;
  txIndex?: Num;
  reason?: string;
};

/**
 * @public
 */
export type ClientIndexerSearchKeyFilterLike =
  ClientCollectableSearchKeyFilterLike & {
    blockRange?: [NumLike, NumLike] | null;
  };
/**
 * @public
 */
export class ClientIndexerSearchKeyFilter {
  constructor(
    public script: Script | undefined,
    public scriptLenRange: [Num, Num] | undefined,
    public outputData: Hex | undefined,
    public outputDataSearchMode: "prefix" | "exact" | "partial" | undefined,
    public outputDataLenRange: [Num, Num] | undefined,
    public outputCapacityRange: [Num, Num] | undefined,
    public blockRange: [Num, Num] | undefined,
  ) {}

  static from(
    filterLike: ClientIndexerSearchKeyFilterLike,
  ): ClientIndexerSearchKeyFilter {
    return new ClientIndexerSearchKeyFilter(
      apply(Script.from, filterLike.script),
      apply(clientSearchKeyRangeFrom, filterLike.scriptLenRange),
      apply(hexFrom, filterLike.outputData),
      filterLike.outputDataSearchMode ?? undefined,
      apply(clientSearchKeyRangeFrom, filterLike.outputDataLenRange),
      apply(clientSearchKeyRangeFrom, filterLike.outputCapacityRange),
      apply(clientSearchKeyRangeFrom, filterLike.blockRange),
    );
  }
}

/**
 * @public
 */
export type ClientIndexerSearchKeyLike = ClientCollectableSearchKeyLike & {
  filter?: ClientIndexerSearchKeyFilterLike | null;
};

/**
 * @public
 */
export class ClientIndexerSearchKey {
  constructor(
    public script: Script,
    public scriptType: "lock" | "type",
    public scriptSearchMode: "prefix" | "exact" | "partial",
    public filter: ClientIndexerSearchKeyFilter | undefined,
    public withData: boolean | undefined,
  ) {}

  static from(keyLike: ClientIndexerSearchKeyLike): ClientIndexerSearchKey {
    return new ClientIndexerSearchKey(
      Script.from(keyLike.script),
      keyLike.scriptType,
      keyLike.scriptSearchMode,
      apply(ClientIndexerSearchKeyFilter.from, keyLike.filter),
      keyLike.withData ?? undefined,
    );
  }
}

/**
 * @public
 */
export type ClientFindCellsResponse = {
  lastCursor: string;
  cells: Cell[];
};

/**
 * @public
 */
export type ClientIndexerSearchKeyTransactionLike = Omit<
  ClientCollectableSearchKeyLike,
  "withData"
> & {
  filter?: ClientIndexerSearchKeyFilterLike | null;
  groupByTransaction?: boolean | null;
};

/**
 * @public
 */
export class ClientIndexerSearchKeyTransaction {
  constructor(
    public script: Script,
    public scriptType: "lock" | "type",
    public scriptSearchMode: "prefix" | "exact" | "partial",
    public filter: ClientIndexerSearchKeyFilter | undefined,
    public groupByTransaction: boolean | undefined,
  ) {}

  static from(
    keyLike: ClientIndexerSearchKeyTransactionLike,
  ): ClientIndexerSearchKeyTransaction {
    return new ClientIndexerSearchKeyTransaction(
      Script.from(keyLike.script),
      keyLike.scriptType,
      keyLike.scriptSearchMode,
      apply(ClientIndexerSearchKeyFilter.from, keyLike.filter),
      keyLike.groupByTransaction ?? undefined,
    );
  }
}

/**
 * @public
 */
export type ClientFindTransactionsResponse = {
  lastCursor: string;
  transactions: {
    txHash: Hex;
    blockNumber: Num;
    txIndex: Num;
    isInput: boolean;
    cellIndex: Num;
  }[];
};

/**
 * @public
 */
export type ClientFindTransactionsGroupedResponse = {
  lastCursor: string;
  transactions: {
    txHash: Hex;
    blockNumber: Num;
    txIndex: Num;
    cells: {
      isInput: boolean;
      cellIndex: Num;
    }[];
  }[];
};

/**
 * @public
 */
export type ClientBlockHeader = {
  compactTarget: Num;
  dao: {
    /**
     * C_i: the total issuance up to and including block i.
     */
    c: Num;
    /**
     * AR_i: the current accumulated rate at block i.
     * AR_j / AR_i reflects the CKByte amount if one deposit 1 CKB to Nervos DAO at block i, and withdraw at block j.
     */
    ar: Num;
    /**
     * S_i: the total unissued secondary issuance up to and including block i,
     * including unclaimed Nervos DAO compensation and treasury funds.
     */
    s: Num;
    /**
     * U_i: the total occupied capacities currently in the blockchain up to and including block i.
     * Occupied capacity is the sum of capacities used to store all cells.
     */
    u: Num;
  };
  epoch: Epoch;
  extraHash: Hex;
  hash: Hex;
  nonce: Num;
  number: Num;
  parentHash: Hex;
  proposalsHash: Hex;
  timestamp: Num;
  transactionsRoot: Hex;
  version: Num;
};

/**
 * @public
 */
export type ClientBlockUncle = {
  header: ClientBlockHeader;
  proposals: Hex[];
};

/**
 * @public
 */
export type ClientBlock = {
  header: ClientBlockHeader;
  proposals: Hex[];
  transactions: Transaction[];
  uncles: ClientBlockUncle[];
};

export interface ErrorClientBaseLike {
  message?: string;
  code?: number;
  data: string;
}
export class ErrorClientBase extends Error {
  public readonly code?: number;
  public readonly data: string;

  constructor(origin: ErrorClientBaseLike) {
    super(`Client request error ${origin.message}`);
    this.code = origin.code;
    this.data = origin.data;
  }
}

export class ErrorClientResolveUnknown extends ErrorClientBase {
  public readonly outPoint: OutPoint;
  constructor(origin: ErrorClientBaseLike, outPointLike: OutPointLike) {
    super(origin);
    this.outPoint = OutPoint.from(outPointLike);
  }
}

export class ErrorClientVerification extends ErrorClientBase {
  public readonly sourceIndex: Num;
  public readonly scriptCodeHash: Hex;

  constructor(
    origin: ErrorClientBaseLike,
    public readonly source: "lock" | "inputType" | "outputType",
    sourceIndex: NumLike,
    public readonly errorCode: number,
    public readonly scriptHashType: "data" | "type",
    scriptCodeHash: HexLike,
  ) {
    super(origin);
    this.sourceIndex = numFrom(sourceIndex);
    this.scriptCodeHash = hexFrom(scriptCodeHash);
  }
}

export class ErrorClientDuplicatedTransaction extends ErrorClientBase {
  public readonly txHash: Hex;

  constructor(origin: ErrorClientBaseLike, txHash: HexLike) {
    super(origin);
    this.txHash = hexFrom(txHash);
  }
}

export class ErrorClientRBFRejected extends ErrorClientBase {
  public readonly currentFee: Num;
  public readonly leastFee: Num;

  constructor(
    origin: ErrorClientBaseLike,
    currentFee: NumLike,
    leastFee: NumLike,
  ) {
    super(origin);
    this.currentFee = numFrom(currentFee);
    this.leastFee = numFrom(leastFee);
  }
}

export class ErrorClientWaitTransactionTimeout extends ErrorClientBase {
  constructor(timeoutLike: NumLike) {
    const timeout = numFrom(timeoutLike);
    super({
      message: `Wait transaction timeout ${timeout}ms`,
      data: JSON.stringify({ timeout }),
    });
  }
}

export class ErrorClientMaxFeeRateExceeded extends ErrorClientBase {
  constructor(limitLike: NumLike, actualLike: NumLike) {
    const limit = numFrom(limitLike);
    const actual = numFrom(actualLike);
    super({
      message: `Max fee rate exceeded limit ${limit.toString()}, actual ${actual.toString()}. Developer might forgot to complete transaction fee before sending. See https://docs.ckbccc.com/classes/_ckb_ccc_core.index.ccc.Transaction.html#completeFeeBy.`,
      data: JSON.stringify({ limit, actual }),
    });
  }
}
