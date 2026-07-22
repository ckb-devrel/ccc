import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cell, OutPoint, Transaction } from "../ckb";
import { ClientCacheMemory } from "./cache/memory";
import { ClientPublicTestnet } from "./clientPublicTestnet";
import { ClientTransactionResponse, ErrorClientVerification } from "./clientTypes";

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

  describe("ErrorClientVerification errorCode parsing", () => {
    function makeVerificationData(errorCode: number | string): string {
      return `Verification(Error { kind: Script, inner: TransactionScriptError { source: Inputs[0].Lock, cause: ValidationFailure: see error code ${errorCode} on page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/0x${"0".repeat(64)}.html`;
    }

    async function getError(
      data: string,
    ): Promise<ErrorClientVerification | undefined> {
      const c = new ClientPublicTestnet({
        transport: {
          async request({ id }) {
            return { id, error: { code: -302, message: "failed", data } };
          },
        },
      });
      try {
        await c.getTip();
      } catch (e) {
        if (e instanceof ErrorClientVerification) return e;
      }
      return undefined;
    }

    it("should parse single-digit positive error code", async () => {
      const error = await getError(makeVerificationData(5));
      expect(error?.errorCode).toBe(5);
    });

    it("should parse multi-digit positive error code", async () => {
      const error = await getError(makeVerificationData(42));
      expect(error?.errorCode).toBe(42);
    });

    it("should parse single-digit negative error code", async () => {
      const error = await getError(makeVerificationData(-1));
      expect(error?.errorCode).toBe(-1);
    });

    it("should parse multi-digit negative error code", async () => {
      const error = await getError(makeVerificationData(-42));
      expect(error?.errorCode).toBe(-42);
    });

    it("should parse i8 lower boundary -128", async () => {
      const error = await getError(makeVerificationData(-128));
      expect(error?.errorCode).toBe(-128);
    });

    it("should parse i8 upper boundary 127", async () => {
      const error = await getError(makeVerificationData(127));
      expect(error?.errorCode).toBe(127);
    });
  });
});
