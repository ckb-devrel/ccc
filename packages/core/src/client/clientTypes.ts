import {
  Cell,
  CellDep,
  CellDepLike,
  Epoch,
  EpochLike,
  HashType,
  HashTypeLike,
  OutPoint,
  OutPointLike,
  Script,
  ScriptLike,
  Transaction,
  TransactionLike,
  epochFrom,
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
    if (cellDepInfoLike instanceof CellDepInfo) {
      return cellDepInfoLike;
    }

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
    if (scriptInfoLike instanceof ScriptInfo) {
      return scriptInfoLike;
    }

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
export type ClientTransactionResponseLike = {
  transaction: TransactionLike;
  status: TransactionStatus;
  cycles?: NumLike;
  blockHash?: HexLike;
  blockNumber?: NumLike;
  txIndex?: NumLike;
  reason?: string;
};
/**
 * @public
 */
export class ClientTransactionResponse {
  constructor(
    public transaction: Transaction,
    public status: TransactionStatus,
    public cycles?: Num,
    public blockHash?: Hex,
    public blockNumber?: Num,
    public txIndex?: Num,
    public reason?: string,
  ) {}

  static from(
    responseLike: ClientTransactionResponseLike,
  ): ClientTransactionResponse {
    if (responseLike instanceof ClientTransactionResponse) {
      return responseLike;
    }

    return new ClientTransactionResponse(
      Transaction.from(responseLike.transaction),
      responseLike.status,
      apply(numFrom, responseLike.cycles),
      apply(hexFrom, responseLike.blockHash),
      apply(numFrom, responseLike.blockNumber),
      apply(numFrom, responseLike.txIndex),
      responseLike.reason,
    );
  }

  clone() {
    return new ClientTransactionResponse(
      this.transaction.clone(),
      this.status,
      this.cycles,
      this.blockHash,
      this.blockNumber,
      this.txIndex,
      this.reason,
    );
  }
}

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
    if (filterLike instanceof ClientIndexerSearchKeyFilter) {
      return filterLike;
    }

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
    if (keyLike instanceof ClientIndexerSearchKey) {
      return keyLike;
    }

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
    if (keyLike instanceof ClientIndexerSearchKeyTransaction) {
      return keyLike;
    }

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
export type ClientBlockHeaderLike = {
  compactTarget: NumLike;
  dao: {
    /**
     * C_i: the total issuance up to and including block i.
     */
    c: NumLike;
    /**
     * AR_i: the current accumulated rate at block i.
     * AR_j / AR_i reflects the CKByte amount if one deposit 1 CKB to Nervos DAO at block i, and withdraw at block j.
     */
    ar: NumLike;
    /**
     * S_i: the total unissued secondary issuance up to and including block i,
     * including unclaimed Nervos DAO compensation and treasury funds.
     */
    s: NumLike;
    /**
     * U_i: the total occupied capacities currently in the blockchain up to and including block i.
     * Occupied capacity is the sum of capacities used to store all cells.
     */
    u: NumLike;
  };
  epoch: EpochLike;
  extraHash: HexLike;
  hash: HexLike;
  nonce: NumLike;
  number: NumLike;
  parentHash: HexLike;
  proposalsHash: HexLike;
  timestamp: NumLike;
  transactionsRoot: HexLike;
  version: NumLike;
};
/**
 * @public
 */
export class ClientBlockHeader {
  constructor(
    public compactTarget: Num,
    public dao: {
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
    },
    public epoch: Epoch,
    public extraHash: Hex,
    public hash: Hex,
    public nonce: Num,
    public number: Num,
    public parentHash: Hex,
    public proposalsHash: Hex,
    public timestamp: Num,
    public transactionsRoot: Hex,
    public version: Num,
  ) {}

  static from(headerLike: ClientBlockHeaderLike): ClientBlockHeader {
    if (headerLike instanceof ClientBlockHeader) {
      return headerLike;
    }

    return new ClientBlockHeader(
      numFrom(headerLike.compactTarget),
      {
        c: numFrom(headerLike.dao.c),
        ar: numFrom(headerLike.dao.ar),
        s: numFrom(headerLike.dao.s),
        u: numFrom(headerLike.dao.u),
      },
      epochFrom(headerLike.epoch),
      hexFrom(headerLike.extraHash),
      hexFrom(headerLike.hash),
      numFrom(headerLike.nonce),
      numFrom(headerLike.number),
      hexFrom(headerLike.parentHash),
      hexFrom(headerLike.proposalsHash),
      numFrom(headerLike.timestamp),
      hexFrom(headerLike.transactionsRoot),
      numFrom(headerLike.version),
    );
  }
}

/**
 * @public
 */
export type ClientBlockUncleLike = {
  header: ClientBlockHeaderLike;
  proposals: HexLike[];
};
/**
 * @public
 */
export class ClientBlockUncle {
  constructor(
    public header: ClientBlockHeader,
    public proposals: Hex[],
  ) {}

  static from(uncleLike: ClientBlockUncleLike): ClientBlockUncle {
    if (uncleLike instanceof ClientBlockUncle) {
      return uncleLike;
    }

    return new ClientBlockUncle(
      ClientBlockHeader.from(uncleLike.header),
      uncleLike.proposals.map(hexFrom),
    );
  }
}

/**
 * @public
 */
export type ClientBlockLike = {
  header: ClientBlockHeaderLike;
  proposals: HexLike[];
  transactions: TransactionLike[];
  uncles: ClientBlockUncleLike[];
};
/**
 * @public
 */
export class ClientBlock {
  constructor(
    public header: ClientBlockHeader,
    public proposals: Hex[],
    public transactions: Transaction[],
    public uncles: ClientBlockUncle[],
  ) {}

  static from(blockLike: ClientBlockLike): ClientBlock {
    if (blockLike instanceof ClientBlock) {
      return blockLike;
    }

    return new ClientBlock(
      ClientBlockHeader.from(blockLike.header),
      blockLike.proposals.map(hexFrom),
      blockLike.transactions.map(Transaction.from),
      blockLike.uncles.map(ClientBlockUncle.from),
    );
  }
}

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
    const timeout = numFrom(timeoutLike).toString();
    super({
      message: `Wait transaction timeout ${timeout}ms`,
      data: JSON.stringify({ timeout }),
    });
  }
}

export class ErrorClientMaxFeeRateExceeded extends ErrorClientBase {
  constructor(limitLike: NumLike, actualLike: NumLike) {
    const limit = numFrom(limitLike).toString();
    const actual = numFrom(actualLike).toString();
    super({
      message: `Max fee rate exceeded limit ${limit}, actual ${actual}. Developer might forgot to complete transaction fee before sending. See https://api.ckbccc.com/classes/_ckb_ccc_core.index.ccc.Transaction.html#completeFeeBy.`,
      data: JSON.stringify({ limit, actual }),
    });
  }
}
