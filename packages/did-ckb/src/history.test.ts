import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { DidCkbData } from "./codec.js";
import { getDidCkbHistory } from "./history.js";

describe("getDidCkbHistory", () => {
  let client: ccc.Client;

  const codeHash =
    "0x510150477b10d6ab551a509b71265f3164e9fd4137fcb5a4322f49f03092c7c5";
  const id = ("0x" + "ab".repeat(20)) as ccc.Hex;

  const fundingLock = ccc.Script.from({
    codeHash: "0x" + "0".repeat(64),
    hashType: "type",
    args: "0xdeadbeef",
  });
  const didTypeScript = ccc.Script.from({
    codeHash,
    hashType: "type",
    args: id,
  });

  // Build a cell + the tx that produced it. Each transferDidCkb consumes the
  // prior DID cell as an input and emits a new one with the same Type ID.
  function didCell(
    txHash: ccc.Hex,
    document: object,
    localId?: string,
  ): ccc.Cell {
    const data = DidCkbData.fromV1({ document, localId });
    return ccc.Cell.from({
      outPoint: { txHash, index: 0 },
      cellOutput: {
        capacity: ccc.fixedPointFrom(300),
        lock: fundingLock,
        type: didTypeScript,
      },
      outputData: ccc.hexFrom(data.toBytes()),
    });
  }

  const txGenesis = ("0x" + "11".repeat(32)) as ccc.Hex;
  const txUpdate1 = ("0x" + "22".repeat(32)) as ccc.Hex;
  const txUpdate2 = ("0x" + "33".repeat(32)) as ccc.Hex;
  const txFunding = ("0x" + "ff".repeat(32)) as ccc.Hex;

  const genesisCell = didCell(txGenesis, { v: 1 });
  const update1Cell = didCell(txUpdate1, { v: 2 });
  const update2Cell = didCell(txUpdate2, { v: 3 });

  beforeEach(() => {
    client = {
      getKnownScript: vi.fn(),
      findSingletonCellByType: vi.fn(),
      getTransaction: vi.fn(),
    } as unknown as ccc.Client;

    (client.getKnownScript as Mock).mockResolvedValue({
      codeHash,
      hashType: "type",
      cellDeps: [],
    });
  });

  function txResponse(
    tx: ccc.TransactionLike,
    blockNumber?: ccc.NumLike,
  ): { transaction: ccc.Transaction; blockNumber?: ccc.Num } {
    return {
      transaction: ccc.Transaction.from(tx),
      blockNumber:
        blockNumber !== undefined ? ccc.numFrom(blockNumber) : undefined,
    };
  }

  it("returns CREATE, UPDATE entries newest-first for a normal mint + two transfers", async () => {
    // Funding tx that produced the input used to create the genesis. Not a
    // DID cell, so the walk should stop at the genesis tx.
    const fundingPrevOut = ccc.CellOutput.from({
      capacity: ccc.fixedPointFrom(1000),
      lock: fundingLock,
    });

    (client.getTransaction as Mock).mockImplementation(
      async (hash: ccc.HexLike) => {
        const h = ccc.hexFrom(hash);
        if (h === txUpdate2) {
          return txResponse(
            {
              inputs: [
                { previousOutput: { txHash: txUpdate1, index: 0 }, since: 0 },
              ],
              outputs: [update2Cell.cellOutput],
              outputsData: [update2Cell.outputData],
            },
            300,
          );
        }
        if (h === txUpdate1) {
          return txResponse(
            {
              inputs: [
                { previousOutput: { txHash: txGenesis, index: 0 }, since: 0 },
              ],
              outputs: [update1Cell.cellOutput],
              outputsData: [update1Cell.outputData],
            },
            200,
          );
        }
        if (h === txGenesis) {
          return txResponse(
            {
              inputs: [
                { previousOutput: { txHash: txFunding, index: 0 }, since: 0 },
              ],
              outputs: [genesisCell.cellOutput],
              outputsData: [genesisCell.outputData],
            },
            100,
          );
        }
        if (h === txFunding) {
          return txResponse({
            inputs: [],
            outputs: [fundingPrevOut],
            outputsData: ["0x"],
          });
        }
        return undefined;
      },
    );

    const history = await getDidCkbHistory({
      client,
      id,
      liveCell: update2Cell,
    });

    expect(history.map((h) => h.action)).toEqual([
      "UPDATE",
      "UPDATE",
      "CREATE",
    ]);
    expect(history[0].txHash).toBe(txUpdate2);
    expect(history[0].blockNumber).toBe(300n);
    expect(history[2].txHash).toBe(txGenesis);
    expect(history[2].data.value.document).toEqual({ v: 1 });
  });

  it("flags the genesis as MIGRATE when localId is set", async () => {
    const migrated = didCell(txGenesis, { v: 1 }, "did:plc:abc");

    (client.getTransaction as Mock).mockImplementation(
      async (hash: ccc.HexLike) => {
        const h = ccc.hexFrom(hash);
        if (h === txGenesis) {
          return txResponse(
            {
              inputs: [
                { previousOutput: { txHash: txFunding, index: 0 }, since: 0 },
              ],
              outputs: [migrated.cellOutput],
              outputsData: [migrated.outputData],
            },
            50,
          );
        }
        if (h === txFunding) {
          return txResponse({
            inputs: [],
            outputs: [
              ccc.CellOutput.from({
                capacity: ccc.fixedPointFrom(1000),
                lock: fundingLock,
              }),
            ],
            outputsData: ["0x"],
          });
        }
        return undefined;
      },
    );

    const history = await getDidCkbHistory({ client, id, liveCell: migrated });
    expect(history.length).toBe(1);
    expect(history[0].action).toBe("MIGRATE");
    expect(history[0].data.value.localId).toBe("did:plc:abc");
  });

  it("returns an empty array when no live cell exists", async () => {
    (client.findSingletonCellByType as Mock).mockResolvedValue(undefined);
    const history = await getDidCkbHistory({ client, id });
    expect(history).toEqual([]);
  });
});
