import { beforeEach, describe, expect, it } from "vitest";
import { ccc } from "../../index.js";
// Mock Data
const MOCK_SCRIPT = {
  codeHash:
    "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type" as const,
  args: "0x",
};

const MOCK_CELL_OUTPUT = {
  capacity: ccc.fixedPointFrom(100),
  lock: MOCK_SCRIPT,
};

const MOCK_OUT_POINT_1 = {
  txHash: "0x" + "1".repeat(64),
  index: 0,
};

const MOCK_OUT_POINT_2 = {
  txHash: "0x" + "2".repeat(64),
  index: 1,
};

const MOCK_CELL_1: ccc.CellLike = {
  cellOutput: MOCK_CELL_OUTPUT,
  outputData: "0x",
  outPoint: MOCK_OUT_POINT_1,
};

const MOCK_CELL_2: ccc.CellLike = {
  cellOutput: MOCK_CELL_OUTPUT,
  outputData: "0x",
  outPoint: MOCK_OUT_POINT_2,
};

const MOCK_TX: ccc.TransactionLike = {
  version: "0x0",
  cellDeps: [],
  headerDeps: [],
  inputs: [],
  outputs: [MOCK_CELL_OUTPUT],
  outputsData: ["0x"],
  witnesses: [],
};

const MOCK_TX_RESPONSE = {
  transaction: MOCK_TX,
  status: "committed" as const,
  blockHash: "0x" + "a".repeat(64),
};

const MOCK_HEADER: ccc.ClientBlockHeaderLike = {
  compactTarget: "0x1",
  dao: {
    c: 0,
    ar: 0,
    s: 0,
    u: 0,
  },
  nonce: 0,
  epoch: [0, 0, 0],
  hash: "0x" + "a".repeat(64),
  number: 0,
  parentHash: "0x" + "b".repeat(64),
  proposalsHash: "0x" + "c".repeat(64),
  timestamp: 0,
  transactionsRoot: "0x" + "d".repeat(64),
  extraHash: "0x" + "e".repeat(64),
  version: "0x0",
};

const MOCK_BLOCK: ccc.ClientBlockLike = {
  header: MOCK_HEADER,
  uncles: [],
  transactions: [MOCK_TX],
  proposals: [],
};

describe("ClientCacheMemory", () => {
  let cache: ccc.ClientCacheMemory;

  beforeEach(() => {
    cache = new ccc.ClientCacheMemory();
  });

  it("should initialize with custom capacities", () => {
    const customCache = new ccc.ClientCacheMemory(10, 20, 30);
    // @ts-expect-error - accessing private property for testing
    expect(customCache.cells.capacity).toBe(10);
    // @ts-expect-error - accessing private property for testing
    expect(customCache.knownTransactions.capacity).toBe(20);
    // @ts-expect-error - accessing private property for testing
    expect(customCache.knownBlocks.capacity).toBe(30);
    // @ts-expect-error - accessing private property for testing
    expect(customCache.knownBlockHashes.capacity).toBe(30);
  });

  it("should mark cells as usable and unusable", async () => {
    await cache.markUsable(MOCK_CELL_1);
    expect(await cache.isUnusable(MOCK_OUT_POINT_1)).toBe(false);

    await cache.markUnusable(MOCK_OUT_POINT_1);
    expect(await cache.isUnusable(MOCK_OUT_POINT_1)).toBe(true);
  });

  it("should clear the cache", async () => {
    await cache.markUsable(MOCK_CELL_1);
    await cache.recordTransactionResponses(MOCK_TX_RESPONSE);

    await cache.clear();

    // @ts-expect-error - accessing private property for testing
    expect(cache.cells.size).toBe(0);
    // @ts-expect-error - accessing private property for testing
    expect(cache.knownTransactions.size).toBe(0);
  });

  it("should find live cells", async () => {
    await cache.markUsable(MOCK_CELL_1, MOCK_CELL_2);
    await cache.markUnusable(MOCK_OUT_POINT_2);

    const cells = [];
    for await (const cell of cache.findCells({
      script: MOCK_SCRIPT,
      scriptType: "lock",
      scriptSearchMode: "exact",
    })) {
      cells.push(cell);
    }

    expect(cells.length).toBe(1);
    expect(ccc.hexFrom(ccc.Cell.from(cells[0]).outPoint.toBytes())).toBe(
      ccc.hexFrom(ccc.Cell.from(MOCK_CELL_1).outPoint.toBytes()),
    );
  });

  it("should record and get cells", async () => {
    await cache.recordCells(MOCK_CELL_1);
    const cell = await cache.getCell(MOCK_OUT_POINT_1);
    expect(cell).toBeDefined();
    expect(ccc.hexFrom(cell!.outPoint.toBytes())).toBe(
      ccc.hexFrom(ccc.Cell.from(MOCK_CELL_1).outPoint.toBytes()),
    );

    expect(await cache.getCell(MOCK_OUT_POINT_2)).toBeUndefined();
  });

  it("should record and get transaction responses", async () => {
    await cache.recordTransactionResponses(MOCK_TX_RESPONSE);
    const txHash = ccc.Transaction.from(MOCK_TX_RESPONSE.transaction).hash();
    const tx = await cache.getTransactionResponse(txHash);
    expect(tx).toBeDefined();
    expect(tx!.transaction.hash()).toBe(txHash);
  });

  it("should record and get headers", async () => {
    await cache.recordHeaders(MOCK_HEADER);
    const headerByHash = await cache.getHeaderByHash(MOCK_HEADER.hash);
    expect(headerByHash).toBeDefined();
    expect(headerByHash!.hash).toBe(MOCK_HEADER.hash);

    const headerByNumber = await cache.getHeaderByNumber(MOCK_HEADER.number);
    expect(headerByNumber).toBeDefined();
    expect(headerByNumber!.hash).toBe(MOCK_HEADER.hash);
  });

  it("should record and get blocks", async () => {
    await cache.recordBlocks(MOCK_BLOCK);
    const blockByHash = await cache.getBlockByHash(MOCK_BLOCK.header.hash);
    expect(blockByHash).toBeDefined();
    expect(blockByHash!.header.hash).toBe(MOCK_BLOCK.header.hash);
    expect(blockByHash!.transactions.length).toBe(1);

    const blockByNumber = await cache.getBlockByNumber(
      MOCK_BLOCK.header.number,
    );
    expect(blockByNumber).toBeDefined();
    expect(blockByNumber!.header.hash).toBe(MOCK_BLOCK.header.hash);
  });

  it("should check if a header is confirmed", () => {
    const cacheWithShortTime = new ccc.ClientCacheMemory(512, 256, 128, 10000);
    const confirmedHeader = ccc.ClientBlockHeader.from(MOCK_HEADER);
    const unconfirmedHeader = ccc.ClientBlockHeader.from({
      ...MOCK_HEADER,
      timestamp: Date.now(),
    });

    expect(cacheWithShortTime.hasHeaderConfirmed(confirmedHeader)).toBe(true);
    expect(cacheWithShortTime.hasHeaderConfirmed(unconfirmedHeader)).toBe(
      false,
    );
  });
});
