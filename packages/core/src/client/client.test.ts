import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cell, OutPoint, Transaction } from "../ckb";
import { ClientCacheMemory } from "./cache/memory";
import { ClientPublicTestnet } from "./clientPublicTestnet";
import { ClientTransactionResponse } from "./clientTypes";

describe("Client", () => {
  let client: ClientPublicTestnet;

  beforeEach(() => {
    client = new ClientPublicTestnet({ cache: new ClientCacheMemory() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCell", () => {
    const outPoint = OutPoint.from({
      txHash: `0x${"0".repeat(64)}`,
      index: 0,
    });
    const cell = Cell.from({
      outPoint,
      cellOutput: {
        capacity: 100,
        lock: {
          codeHash: `0x${"0".repeat(64)}`,
          hashType: "type",
          args: "0x",
        },
      },
    });
    const transaction = Transaction.from({
      outputs: [cell.cellOutput],
    });
    const txResponse = ClientTransactionResponse.from({
      transaction,
      status: "committed",
    });

    it("should return the cell from cache if it exists", async () => {
      const cacheSpy = vi
        .spyOn(client.cache, "getCell")
        .mockResolvedValue(cell);
      const getTransactionSpy = vi.spyOn(client, "getTransaction");

      const result = await client.getCell(outPoint);

      expect(result).toEqual(cell);
      expect(cacheSpy).toHaveBeenCalledWith(outPoint);
      expect(getTransactionSpy).not.toHaveBeenCalled();
    });

    it("should fetch the cell from the transaction if not in cache", async () => {
      const cacheGetSpy = vi
        .spyOn(client.cache, "getCell")
        .mockResolvedValue(undefined);
      const cacheRecordSpy = vi
        .spyOn(client.cache, "recordCells")
        .mockResolvedValue();
      const getTransactionSpy = vi
        .spyOn(client, "getTransaction")
        .mockResolvedValue(txResponse);

      const result = await client.getCell(outPoint);

      expect(result).toEqual(cell);
      expect(cacheGetSpy).toHaveBeenCalledWith(outPoint);
      expect(getTransactionSpy).toHaveBeenCalledWith(outPoint.txHash);
      expect(cacheRecordSpy).toHaveBeenCalledWith(cell);
    });

    it("should return undefined if transaction is not found", async () => {
      vi.spyOn(client.cache, "getCell").mockResolvedValue(undefined);
      vi.spyOn(client, "getTransaction").mockResolvedValue(undefined);

      const result = await client.getCell(outPoint);

      expect(result).toBeUndefined();
    });

    it("should return undefined if output is not found in transaction", async () => {
      vi.spyOn(client.cache, "getCell").mockResolvedValue(undefined);
      const anotherTx = Transaction.from({
        outputs: [],
      });
      const anotherTxResponse = {
        transaction: anotherTx,
      } as ClientTransactionResponse;
      vi.spyOn(client, "getTransaction").mockResolvedValue(anotherTxResponse);

      const result = await client.getCell(outPoint);
      expect(result).toBeUndefined();
    });
  });
});
