import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { buildTypeIdOperations } from "./advancedBarrel.js";

describe("type-id", () => {
  let client: ccc.Client;
  let signer: ccc.Signer;

  const typeIdScript = {
    codeHash:
      "0x00000000000000000000000000000000000000000000000000545950455f4944",
    hashType: "type" as const,
    args: "0x",
  };
  const typeIdCellDep = {
    outPoint: {
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      index: 0,
    },
    depType: "code" as const,
  };

  beforeEach(() => {
    client = {
      getKnownScript: vi.fn(),
      getCellDeps: vi.fn(),
      findSingletonCellByType: vi.fn(),
    } as unknown as ccc.Client;

    signer = {
      client,
      getRecommendedAddressObj: vi.fn(),
      findCells: vi.fn(),
    } as unknown as ccc.Signer;

    (client.getKnownScript as Mock).mockResolvedValue({
      ...typeIdScript,
      cellDeps: [{ cellDep: typeIdCellDep }],
    });

    (client.getCellDeps as Mock).mockImplementation(
      async (deps: ccc.CellDepInfoLike[]) =>
        deps.map((d) => ccc.CellDep.from(d.cellDep)),
    );

    (signer.getRecommendedAddressObj as Mock).mockResolvedValue({
      script: ccc.Script.from({
        codeHash: "0x" + "0".repeat(64),
        hashType: "type",
        args: "0x1234",
      }),
    });
  });

  describe("buildTypeIdOperations with custom options", () => {
    it("should use custom codec", async () => {
      const customCodec = {
        encode: (data: number) => ccc.numLeToBytes(data, 4),
        decode: (bytes: ccc.BytesLike) => Number(ccc.numLeFromBytes(bytes)),
      };

      const { create } = buildTypeIdOperations({
        getScriptInfo: async () => ({
          ...typeIdScript,
          cellDeps: [{ cellDep: typeIdCellDep }],
        }),
        codec: customCodec,
      });

      const inputCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock: ccc.Script.from({
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          }),
        },
        outputData: "0x",
      });
      (signer.findCells as Mock).mockImplementation(async function* () {
        yield inputCell;
      });

      const { tx } = await create({
        signer,
        data: 123456,
      });

      expect(tx.outputsData[0]).toBe(ccc.hexFrom(ccc.numLeToBytes(123456, 4)));
    });

    it("should use custom calculateTypeId", async () => {
      const customId = "0x" + "9".repeat(64);
      const calculateTypeId = vi.fn().mockResolvedValue(customId);

      const { create } = buildTypeIdOperations({
        getScriptInfo: async () => ({
          ...typeIdScript,
          cellDeps: [{ cellDep: typeIdCellDep }],
        }),
        calculateTypeId,
      });

      const inputCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock: ccc.Script.from({
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          }),
        },
        outputData: "0x",
      });
      (signer.findCells as Mock).mockImplementation(async function* () {
        yield inputCell;
      });

      const { id, tx } = await create({
        signer,
        data: "0x",
      });

      expect(calculateTypeId).toHaveBeenCalled();
      expect(id).toBe(customId);
      expect(tx.outputs[0].type?.args).toBe(customId);
    });

    it("should use custom addCellDeps", async () => {
      const customDep = ccc.CellDep.from({
        outPoint: { txHash: "0x" + "a".repeat(64), index: 0 },
        depType: "code",
      });
      const addCellDeps = vi
        .fn()
        .mockImplementation(async (_: ccc.Client, tx: ccc.Transaction) => {
          tx.addCellDeps(customDep);
          return tx;
        });

      const { create } = buildTypeIdOperations({
        getScriptInfo: async () => ({
          ...typeIdScript,
          cellDeps: [{ cellDep: typeIdCellDep }],
        }),
        addCellDeps,
      });

      const inputCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock: ccc.Script.from({
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          }),
        },
        outputData: "0x",
      });
      (signer.findCells as Mock).mockImplementation(async function* () {
        yield inputCell;
      });

      const { tx } = await create({
        signer,
        data: "0x",
      });

      expect(addCellDeps).toHaveBeenCalled();
      expect(tx.cellDeps).toContainEqual(customDep);
    });
  });

  describe("Type ID Operations", () => {
    const { create, transfer, destroy } = buildTypeIdOperations({
      getScriptInfo: async () => ({
        ...typeIdScript,
        cellDeps: [{ cellDep: typeIdCellDep }],
      }),
    });

    describe("create", () => {
      it("should create a transaction with correct type id", async () => {
        const inputCell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "2".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(1000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
          },
          outputData: "0x",
        });

        (signer.findCells as Mock).mockImplementation(async function* () {
          yield inputCell;
        });

        const data = "0x1234";
        const { tx, id, index } = await create({
          signer,
          data,
        });

        expect(tx.inputs.length).toBe(1);
        expect(tx.inputs[0].previousOutput).toEqual(inputCell.outPoint);

        expect(tx.outputs.length).toBe(1);
        expect(index).toBe(0);

        const expectedId = ccc.hashTypeId(tx.inputs[0], 0);
        expect(id).toBe(expectedId);

        const output = tx.outputs[0];
        expect(output.type).toBeDefined();
        expect(output.type?.codeHash).toBe(typeIdScript.codeHash);
        expect(output.type?.hashType).toBe(typeIdScript.hashType);
        expect(output.type?.args).toBe(id);
        expect(tx.outputsData[0]).toBe(ccc.hexFrom(data));

        expect(tx.cellDeps.length).toBeGreaterThan(0);
        expect(tx.cellDeps[0].outPoint).toEqual(
          ccc.OutPoint.from(typeIdCellDep.outPoint),
        );
      });

      it(" should append to existing tx", async () => {
        const existingTx = ccc.Transaction.from({
          headerDeps: ["0x" + "e".repeat(64)],
        });

        const inputCell = ccc.Cell.from({
          outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
          cellOutput: {
            capacity: ccc.fixedPointFrom(1000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
          },
          outputData: "0x",
        });
        (signer.findCells as Mock).mockImplementation(async function* () {
          yield inputCell;
        });

        const { tx } = await create({
          signer,
          data: "0x",
          tx: existingTx,
        });

        expect(tx.headerDeps).toContain("0x" + "e".repeat(64));
      });
    });

    it("should accept explicit receiver", async () => {
      const receiver = ccc.Script.from({
        codeHash: "0x" + "0".repeat(64),
        hashType: "type",
        args: "0xffee",
      });

      const inputCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock: ccc.Script.from({
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          }),
        },
        outputData: "0x",
      });
      (signer.findCells as Mock).mockImplementation(async function* () {
        yield inputCell;
      });

      const { tx } = await create({
        signer,
        data: "0x",
        receiver,
      });

      expect(tx.outputs[0].lock).toEqual(receiver);
    });

    describe("transferTypeId", () => {
      it("should transfer type id cell to new receiver", async () => {
        const id = "0x" + "3".repeat(64);
        const receiver = ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "type",
          args: "0xabcd",
        });

        const typeScript = ccc.Script.from({
          ...typeIdScript,
          args: id,
        });

        const existingCell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "4".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(2000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
            type: typeScript,
          },
          outputData: "0x5678",
        });

        (client.findSingletonCellByType as Mock).mockResolvedValue(
          existingCell,
        );

        const newData = "0x9999";
        const { tx, inIndex, outIndex } = await transfer({
          client,
          id,
          receiver,
          data: newData,
        });

        expect(tx.inputs[inIndex].previousOutput).toEqual(
          existingCell.outPoint,
        );

        const output = tx.outputs[outIndex];
        expect(output.lock).toEqual(receiver);
        expect(output.type).toEqual(typeScript);
        expect(tx.outputsData[outIndex]).toBe(ccc.hexFrom(newData));
      });

      it("transfer should preserve data if not provided", async () => {
        const id = "0x" + "3".repeat(64);
        const receiver = ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "type",
          args: "0xabcd",
        });
        const typeScript = ccc.Script.from({ ...typeIdScript, args: id });
        const existingCell = ccc.Cell.from({
          outPoint: { txHash: "0x" + "4".repeat(64), index: 0 },
          cellOutput: {
            capacity: ccc.fixedPointFrom(2000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
            type: typeScript,
          },
          outputData: "0x123456",
        });

        (client.findSingletonCellByType as Mock).mockResolvedValue(
          existingCell,
        );

        const { tx, outIndex } = await transfer({
          client,
          id,
          receiver,
        });

        expect(tx.outputsData[outIndex]).toBe("0x123456");
      });

      it("should transfer type id cell with data transformer", async () => {
        const id = "0x" + "3".repeat(64);
        const receiver = ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "type",
          args: "0xabcd",
        });

        const typeScript = ccc.Script.from({
          ...typeIdScript,
          args: id,
        });

        const existingCell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "4".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(2000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
            type: typeScript,
          },
          outputData: "0x1234",
        });

        (client.findSingletonCellByType as Mock).mockResolvedValue(
          existingCell,
        );

        const { tx, outIndex } = await transfer({
          client,
          id,
          receiver,
          data: (c, d) => ccc.bytesConcat(c.outputData, d ?? "0x", "0x5678"),
        });

        const output = tx.outputs[outIndex];
        expect(output.lock).toEqual(receiver);
        expect(output.type).toEqual(typeScript);
        expect(tx.outputsData[outIndex]).toBe(ccc.hexFrom("0x123412345678"));
      });

      it("should throw error if type id cell not found", async () => {
        (client.findSingletonCellByType as Mock).mockResolvedValue(undefined);

        await expect(
          transfer({
            client,
            id: "0x" + "0".repeat(64),
            receiver: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
          }),
        ).rejects.toThrow("Type ID");
      });
    });

    describe("destroyTypeId", () => {
      it("should consume type id cell without creating new one", async () => {
        const id = "0x" + "5".repeat(64);
        const typeScript = ccc.Script.from({
          ...typeIdScript,
          args: id,
        });

        const existingCell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "6".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(3000),
            lock: ccc.Script.from({
              codeHash: "0x" + "0".repeat(64),
              hashType: "type",
              args: "0x",
            }),
            type: typeScript,
          },
          outputData: "0x",
        });

        (client.findSingletonCellByType as Mock).mockResolvedValue(
          existingCell,
        );

        const { tx, index } = await destroy({
          client,
          id,
        });

        expect(tx.inputs[index].previousOutput).toEqual(existingCell.outPoint);

        const hasTypeOutput = tx.outputs.some((o) => o.type?.eq(typeScript));
        expect(hasTypeOutput).toBe(false);
      });
    });
  });
});
