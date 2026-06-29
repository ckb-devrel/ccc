import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoinAction } from "../coBuild.js";
import { Coin } from "./coin.js";

let client: ccc.Client;
let signer: ccc.Signer;
let lock: ccc.Script;
let type: ccc.Script;
let coin: Coin;

beforeEach(async () => {
  client = new ccc.ClientPublicTestnet();
  signer = new ccc.SignerCkbPublicKey(
    client,
    "0x026f3255791f578cc5e38783b6f2d87d4709697b797def6bf7b3b9af4120e2bfd9",
  );
  lock = (await signer.getRecommendedAddressObj()).script;

  type = await ccc.Script.fromKnownScript(
    client,
    ccc.KnownScript.XUdt,
    "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2",
  );

  // Create Coin instance
  coin = new Coin({ script: type, client, cellDeps: [] });
});

describe("Coin", () => {
  describe("completeInputsByAmount", () => {
    // Mock Coins with amount 100 each (10 total, amount = 1000)
    let mockCoins: ccc.Cell[];

    beforeEach(async () => {
      // Create mock Coins after type is initialized
      mockCoins = Array.from({ length: 10 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"0".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(142),
            lock,
            type,
          },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100
        }),
      );
    });

    beforeEach(() => {
      // Mock the findCells method to return our mock Coins
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      // Mock client.getCell to return the cell data for inputs
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockCoins.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });
    });

    it("should return 0 when no Coin amount is needed", async () => {
      const { addedCount, tx } = await coin.completeInputsByAmount(signer);
      expect(addedCount).toBe(0);
      expect(tx.outputs).toEqual([]);
    });

    it("should collect exactly the required Coin amount", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need amount of 150
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Should add 2 Coins (total amount: 200) to have at least 2 inputs
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      // Verify the inputs are Coins
      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(200));
    });

    it("should collect exactly one cell when amount matches exactly", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need amount of exactly 100
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Should add only 1 cell since it matches exactly
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(100));
    });

    it("should handle amountTweak parameter", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need amount of 100
      });

      // Add 50 extra to amount requirement via amountTweak
      const { addedCount } = await coin.completeInputsByAmount(signer, tx, 50);

      // Should add 2 Coins to cover total amount requirement of 150
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(200));
    });

    it("should return 0 when existing inputs already satisfy the requirement", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCoins[0].outPoint,
          },
          {
            previousOutput: mockCoins[1].outPoint,
          },
        ],
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need amount of 150, already have 200
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Should not add any inputs since we already have enough
      expect(addedCount).toBe(0);
      expect(tx.inputs.length).toBe(2);
    });

    it("should throw error when insufficient Coin amount available", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(1500, 16)], // Need amount of 1500, only have 1000 available
      });

      await expect(coin.completeInputsByAmount(signer, tx)).rejects.toThrow(
        "Insufficient coin, need 500 extra coin",
      );
    });

    it("should handle multiple Coin outputs correctly", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
          {
            lock,
            type,
          },
        ],
        outputsData: [
          ccc.numLeToBytes(100, 16), // First output: amount 100
          ccc.numLeToBytes(150, 16), // Second output: amount 150
        ], // Total amount needed: 250
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Should add 3 Coins to cover amount requirement of 250 (total amount: 300)
      expect(addedCount).toBe(3);
      expect(tx.inputs.length).toBe(3);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(300));

      const outputAmount = await coin.getOutputsAmount(tx);
      expect(outputAmount).toBe(ccc.numFrom(250));
    });

    it("should skip Coins already used as inputs", async () => {
      // Pre-add one of the mock Coins as input
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCoins[0].outPoint,
          },
        ],
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need amount of 150, already have 100
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Should add 1 more Coin (since we already have 1 input with amount 100)
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(2);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(200));
    });

    it("should add one cell when user needs less than one cell", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need only amount of 50 (less than one Coin)
      });

      const { addedCount } = await coin.completeInputsByAmount(signer, tx);

      // Coin completeInputsByAmount adds minimum inputs needed
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(100));
    });
  });

  describe("completeInputsAll", () => {
    // Mock Coins with amount 100 each (5 total, amount = 500)
    let mockCoins: ccc.Cell[];

    beforeEach(async () => {
      // Create mock Coins after type is initialized
      mockCoins = Array.from({ length: 5 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"a".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(142 + i * 10), // Varying capacity: 142, 152, 162, 172, 182
            lock,
            type,
          },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100 each
        }),
      );
    });

    beforeEach(() => {
      // Mock the findCells method to return our mock Coins
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      // Mock client.getCell to return the cell data for inputs
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockCoins.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });
    });

    it("should add all available Coins to empty transaction", async () => {
      const { tx: completedTx, addedCount } =
        await coin.completeInputsAll(signer);

      // Should add all 5 available Coins
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total Coin amount is 500 (5 Coins, amount 100 each)
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(500));

      // Verify all Coins were added by checking outpoints
      const addedOutpoints = completedTx.inputs.map(
        (input) => input.previousOutput,
      );
      for (const cell of mockCoins) {
        expect(addedOutpoints.some((op) => op.eq(cell.outPoint))).toBe(true);
      }
    });

    it("should add all available Coins to transaction with outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type },
          { lock, type },
        ],
        outputsData: [
          ccc.numLeToBytes(150, 16), // amount: 150
          ccc.numLeToBytes(200, 16), // amount: 200
        ], // Total amount needed: 350
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should add all 5 available Coins regardless of output requirements
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total Coin amount is 500 (all available)
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(500));

      // Verify output amount is still 350
      const outputAmount = await coin.getOutputsAmount(completedTx);
      expect(outputAmount).toBe(ccc.numFrom(350));

      // Should have excess amount of 150 (500 - 350)
      const amountBurned = await coin.getAmountBurned(completedTx);
      expect(amountBurned).toBe(ccc.numFrom(150));
    });

    it("should skip Coins already used as inputs", async () => {
      // Pre-add 2 of the mock Coins as inputs
      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: mockCoins[0].outPoint },
          { previousOutput: mockCoins[1].outPoint },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should add the remaining 3 Coins (Coins 2, 3, 4)
      expect(addedCount).toBe(3);
      expect(completedTx.inputs.length).toBe(5); // 2 existing + 3 added

      // Verify total Coin amount is still 500 (all 5 Coins)
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(500));
    });

    it("should return 0 when all Coins are already used as inputs", async () => {
      // Pre-add all mock Coins as inputs
      const tx = ccc.Transaction.from({
        inputs: mockCoins.map((cell) => ({ previousOutput: cell.outPoint })),
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should not add any new inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(5); // Same as before

      // Verify total Coin amount is still 500
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(500));
    });

    it("should handle transaction with no Coin outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock }, // Non-Coin output
        ],
        outputsData: ["0x"],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should add all 5 Coins even though no Coin outputs
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Total amount of 500 will be "burned" since no Coin outputs
      const amountBurned = await coin.getAmountBurned(completedTx);
      expect(amountBurned).toBe(ccc.numFrom(500));
    });

    it("should work with mixed input types", async () => {
      // Create a non-Coin cell
      const nonCoin = ccc.Cell.from({
        outPoint: { txHash: "0x" + "f".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock,
          // No type script
        },
        outputData: "0x",
      });

      // Pre-add the non-Coin cell as input
      const tx = ccc.Transaction.from({
        inputs: [{ previousOutput: nonCoin.outPoint }],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      // Mock getCell to handle both Coin and non-Coins
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const outPointObj = ccc.OutPoint.from(outPoint);
        if (outPointObj.eq(nonCoin.outPoint)) {
          return nonCoin;
        }
        return mockCoins.find((c) => c.outPoint.eq(outPointObj));
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should add all 5 Coins
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(6); // 1 non-Coin + 5 Coin

      // Verify only Coin amount is counted
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(500));
    });

    it("should handle empty cell collection gracefully", async () => {
      // Mock findCells to return no cells
      vi.spyOn(signer, "findCells").mockImplementation(async function* () {
        // Return no Coins
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(
        signer,
        tx,
      );

      // Should not add any inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(0);

      // Coin amount should be 0
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(inputAmount).toBe(ccc.numFrom(0));
    });
  });

  describe("getInputsAmount", () => {
    it("should calculate total Coin amount from inputs", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(200, 16), // amount: 200
        }),
      ];

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCells.find((c) => c.outPoint.eq(outPoint));
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: mockCells[0].outPoint },
          { previousOutput: mockCells[1].outPoint },
        ],
      });

      const amount = await coin.getInputsAmount(tx);
      expect(amount).toBe(ccc.numFrom(300)); // 100 + 200
    });

    it("should ignore inputs without matching type script", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock }, // No type script
          outputData: "0x",
        }),
      ];

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCells.find((c) => c.outPoint.eq(outPoint));
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: mockCells[0].outPoint },
          { previousOutput: mockCells[1].outPoint },
        ],
      });

      const amount = await coin.getInputsAmount(tx);
      expect(amount).toBe(ccc.numFrom(100)); // Only the Coin
    });
  });

  describe("getOutputsAmount", () => {
    it("should calculate total Coin amount from outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type },
          { lock, type },
          { lock }, // No type script
        ],
        outputsData: [
          ccc.numLeToBytes(100, 16), // amount: 100
          ccc.numLeToBytes(200, 16), // amount: 200
          "0x", // Not Coin
        ],
      });

      const amount = await coin.getOutputsAmount(tx);
      expect(amount).toBe(ccc.numFrom(300)); // 100 + 200, ignoring non-Coin output
    });

    it("should return 0 when no Coin outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script
        outputsData: ["0x"],
      });

      const amount = await coin.getOutputsAmount(tx);
      expect(amount).toBe(ccc.numFrom(0));
    });
  });

  describe("completeChangeToLock", () => {
    let mockCoins: ccc.Cell[];

    beforeEach(() => {
      mockCoins = Array.from({ length: 5 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"0".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100 each
        }),
      );

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCoins.find((c) => c.outPoint.eq(outPoint));
      });
    });

    it("should add change output when there's excess Coin amount", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need amount of 150
      });

      const { tx: completedTx } = await coin.completeChangeToLock(
        signer,
        changeLock,
        tx,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);
      expect(completedTx.outputs[1].type?.eq(type)).toBe(true);

      // Change should have amount of 50 (input 200 - output 150)
      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(ccc.numFrom(50));
    });

    it("returns correct changeIndexes, hasChanged, addedInputs", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      // Case 1: change output is created
      const tx1 = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)],
      });
      const res1 = await coin.completeChangeToLock(signer, changeLock, tx1);
      expect(res1.hasChanged).toBe(true);
      expect(res1.changeIndexes).toEqual([1]); // appended after the existing output
      expect(res1.addedInputs).toBeGreaterThan(0);

      // Case 2: no excess amount — no change output
      const tx2 = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(200, 16)],
      });
      const res2 = await coin.completeChangeToLock(signer, changeLock, tx2);
      expect(res2.hasChanged).toBe(false);
      expect(res2.changeIndexes).toEqual([]);
    });

    it("transformer: appends extra bytes whose count equals amount / 100", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: async (cell) => {
          const amount = await coin.amountFrom(cell);
          const extraLen = Number(amount / 100n);
          const extra = new Uint8Array(extraLen).fill(0xff);
          return {
            ...cell,
            outputData: ccc.hexFrom(
              ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extra),
            ),
          };
        },
      });

      // output amount = 0, inputs will cover 100 (1 cell), change = 100 → extra = 1 byte
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      const { tx: completedTx } =
        await coinWithTransformer.completeChangeToLock(signer, changeLock, tx);

      // change output should have been added
      expect(completedTx.outputs.length).toBe(2);

      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      const changeData = ccc.bytesFrom(completedTx.outputsData[1]);
      const expectedExtraLen = Number(changeAmount / 100n);

      // outputData = 16 bytes amount + extra bytes
      expect(changeData.length).toBe(16 + expectedExtraLen);
      // all extra bytes are 0xff
      for (let i = 16; i < changeData.length; i++) {
        expect(changeData[i]).toBe(0xff);
      }

      // capacity must be enough to cover the enlarged data
      const minCapacity = ccc.CellOutput.from(
        completedTx.outputs[1],
        completedTx.outputsData[1],
      ).capacity;
      expect(completedTx.outputs[1].capacity).toBeGreaterThanOrEqual(
        minCapacity,
      );
    });

    it("transformer: oversized capacity set by transformer is preserved, not shrunk", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      // transformer sets capacity to 1000 CKB, far above the minimum
      const bigCapacity = ccc.fixedPointFrom(1000);

      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: (cell) => ({
          ...cell,
          cellOutput: { ...cell.cellOutput, capacity: bigCapacity },
        }),
      });

      const { tx: completedTx } =
        await coinWithTransformer.completeChangeToLock(signer, changeLock, tx);

      expect(completedTx.outputs.length).toBe(2);
      // capacity must not be reduced below what transformer set
      expect(completedTx.outputs[1].capacity).toBeGreaterThanOrEqual(
        bigCapacity,
      );
    });
  });

  describe("completeBy", () => {
    it("should use signer's recommended address for change", async () => {
      const mockCoins = Array.from({ length: 3 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"0".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
      );

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCoins.find((c) => c.outPoint.eq(outPoint));
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)],
      });

      const { tx: completedTx } = await coin.completeBy(signer, tx);

      // Should have change output with signer's lock
      expect(completedTx.outputs.length).toBe(2);
      expect(completedTx.outputs[1].lock.eq(lock)).toBe(true); // Same as signer's lock
    });
  });

  describe("complete method with capacity handling", () => {
    let mockCoins: ccc.Cell[];

    beforeEach(() => {
      // Create mock Coins with different capacity values
      mockCoins = [
        // Cell 0: amount 100, 142 CKB capacity (minimum)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 1: amount 100, 200 CKB capacity (extra capacity)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 2: amount 100, 300 CKB capacity (more extra capacity)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(300), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
      ];

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCoins.find((c) => c.outPoint.eq(outPoint));
      });
    });

    it("should add extra Coins when change output requires additional capacity", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      // Create a transaction that needs amount of 50 (less than one Coin)
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      const { tx: completedTx } = await coin.completeChangeToLock(
        signer,
        changeLock,
        tx,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);

      // Verify inputs were added to cover both Coin amount and capacity requirements
      expect(completedTx.inputs.length).toBe(2);

      // Check that change output has correct Coin amount (should be input - 50)
      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      const inputAmount = await coin.getInputsAmount(completedTx);
      expect(changeAmount).toBe(inputAmount - ccc.numFrom(50));

      // Verify change output has correct type script
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);

      // Key assertion: verify that capacity is sufficient (positive fee)
      const fee = await completedTx.getFee(client);
      expect(fee).toBeGreaterThanOrEqual(ccc.Zero);
    });

    it("should handle capacity tweak parameter in completeInputsByAmount", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need amount of 50
      });

      // Add extra capacity requirement via capacityTweak that's reasonable
      const extraCapacityNeeded = ccc.fixedPointFrom(1000); // Reasonable capacity requirement
      const { addedCount } = await coin.completeInputsByAmount(
        signer,
        tx,
        ccc.Zero, // No extra Coin amount needed
        extraCapacityNeeded, // Extra capacity needed
      );

      // Should add Coins to cover the capacity requirement
      expect(addedCount).toBeGreaterThan(2);

      // Should have added at least one cell with capacity
      expect(await coin.getInputsAmount(tx)).toBeGreaterThan(ccc.Zero);
    });

    it("should handle the two-phase capacity completion in complete method", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      // Create a transaction that will need change
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need amount of 50, change will have amount of 50
      });

      // Track the calls to completeInputsByAmount to verify two-phase completion
      const completeInputsSpy = vi.spyOn(coin, "completeInputsByAmount");

      const { tx: completedTx } = await coin.completeChangeToLock(
        signer,
        changeLock,
        tx,
      );

      // Should have called completeInputsByAmount twice:
      // 1. First call: initial Coin amount completion
      // 2. Second call: with extraCapacity for change output
      expect(completeInputsSpy).toHaveBeenCalledTimes(2);

      // Verify the second call included extraCapacity parameter
      const secondCall = completeInputsSpy.mock.calls[1];
      expect(secondCall[2]).toBe(ccc.Zero); // amountTweak should be 0
      expect(secondCall[3]).toBeGreaterThan(ccc.Zero); // capacityTweak should be > 0 (change output capacity)

      // Should have change output
      expect(completedTx.outputs.length).toBe(2);
      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(
        (await coin.getInputsAmount(completedTx)) - ccc.numFrom(50),
      ); // 100 input - 50 output = 50 change

      completeInputsSpy.mockRestore();
    });

    it("should handle completeChangeToOutput correctly", async () => {
      // Create a transaction with an existing Coin output that will receive change
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type }, // This will be the change output
        ],
        outputsData: [
          ccc.numLeToBytes(50, 16), // Initial amount in change output
        ],
      });

      const { tx: completedTx } = await coin.completeChangeToOutput(
        signer,
        0,
        tx,
      ); // Use first output as change

      // Should have added inputs
      expect(completedTx.inputs.length).toBeGreaterThan(0);

      // The first output should now contain the original amount plus any excess from inputs
      const changeAmount = await coin.amountFrom(completedTx.getOutput(0)!);
      const inputAmount = await coin.getInputsAmount(completedTx);

      // Change output should have: original amount + excess from inputs
      // Since we only have one output, all input amount should go to it
      expect(changeAmount).toBe(inputAmount);
      expect(changeAmount).toBeGreaterThan(ccc.numFrom(50)); // More than the original amount
    });

    it("should throw error when change output is not a Coin cell", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script - not a Coin
        outputsData: ["0x"],
      });

      await expect(coin.completeChangeToOutput(signer, 0, tx)).rejects.toThrow(
        "Change output must be a Coin",
      );
    });

    it("should throw error when change output index does not exist", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      await expect(coin.completeChangeToOutput(signer, 5, tx)).rejects.toThrow(
        "Output at index 5 does not exist",
      );
    });

    it("completeChangeToOutput transformer: appends extra bytes whose count equals amount / 100", async () => {
      // Use a coin with 200 CKB capacity so there is 58 CKB surplus after covering the
      // 142 CKB minimum output.  The transformer appends 1 extra byte (= 1 CKB delta).
      // With the correct delta calculation the surplus covers the delta → only 1 input.
      // With a buggy full-capacity tweak (142 CKB) the surplus would be insufficient and
      // a second input would be pulled in unnecessarily.
      const highCapCoin = ccc.Cell.from({
        outPoint: { txHash: "0x" + "a".repeat(64), index: 0 },
        cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
        outputData: ccc.numLeToBytes(100, 16),
      });
      vi.spyOn(signer, "findCells").mockImplementationOnce(async function* () {
        yield highCapCoin;
      });
      vi.spyOn(client, "getCell").mockImplementationOnce(
        async () => highCapCoin,
      );

      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: async (cell) => {
          const amount = await coin.amountFrom(cell);
          const extra = new Uint8Array(Number(amount / 100n)).fill(0xee);
          return {
            ...cell,
            outputData: ccc.hexFrom(
              ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extra),
            ),
          };
        },
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      const { tx: completedTx } =
        await coinWithTransformer.completeChangeToOutput(signer, 0, tx);

      const changeAmount = await coin.amountFrom(completedTx.getOutput(0)!);
      const changeData = ccc.bytesFrom(completedTx.outputsData[0]);
      const expectedExtraLen = Number(changeAmount / 100n);

      expect(changeData.length).toBe(16 + expectedExtraLen);
      for (let i = 16; i < changeData.length; i++) {
        expect(changeData[i]).toBe(0xee);
      }

      const minCapacity = ccc.CellOutput.from(
        completedTx.outputs[0],
        completedTx.outputsData[0],
      ).capacity;
      expect(completedTx.outputs[0].capacity).toBeGreaterThanOrEqual(
        minCapacity,
      );

      // The 200 CKB coin input provides 58 CKB surplus over the 142 CKB output minimum.
      // The transformer's 1-byte increase is only 1 CKB delta, well within the surplus,
      // so exactly 1 coin input should suffice.
      expect(completedTx.inputs.length).toBe(1);
    });

    it("completeChangeToOutput: output capacity covers data after transformer enlarges it", async () => {
      // Regression test: the change callback reads from the live tx on each call (not a
      // stale closure capture), so the capacity delta is computed correctly even when
      // CellOutput.from internally mutates the same CellOutput instance.
      //
      // A transformer that appends 100 bytes forces an ~1 CKB capacity increase.
      // The final output's capacity must be >= the minimum required by the enlarged data.
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: async (cell) => ({
          ...cell,
          outputData: ccc.hexFrom(
            ccc.bytesConcat(
              ccc.bytesFrom(cell.outputData),
              new Uint8Array(100).fill(0xab),
            ),
          ),
        }),
      });

      const { tx: completedTx } =
        await coinWithTransformer.completeChangeToOutput(signer, 0, tx);

      const minCapacity = ccc.CellOutput.from(
        completedTx.outputs[0],
        completedTx.outputsData[0],
      ).capacity;

      expect(completedTx.outputs[0].capacity).toBeGreaterThanOrEqual(
        minCapacity,
      );
      // The appended 100 bytes must actually be present
      expect(ccc.bytesFrom(completedTx.outputsData[0]).length).toBe(16 + 100);
    });

    it("should handle capacity calculation when transaction has non-Coin inputs with high capacity", async () => {
      // Create a non-Coin cell with very high capacity
      const nonCoin = ccc.Cell.from({
        outPoint: { txHash: "0x" + "f".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(10000), // Very high capacity (100 CKB)
          lock,
          // No type script - this is a regular CKB cell
        },
        outputData: "0x", // Empty data
      });

      // Create a transaction that already has the non-Coin input
      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: nonCoin.outPoint }, // Pre-existing non-Coin input
        ],
        outputs: [
          { lock, type }, // Coin output with amount of 50
        ],
        outputsData: [
          ccc.numLeToBytes(50, 16), // amount: 50
        ],
      });

      // Mock getCell to return both Coin and non-Coins
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const outPointObj = ccc.OutPoint.from(outPoint);
        if (outPointObj.eq(nonCoin.outPoint)) {
          return nonCoin;
        }
        return mockCoins.find((c) => c.outPoint.eq(outPointObj));
      });

      const { tx: resultTx } = await coin.completeBy(signer, tx);

      // Should add exactly 2 Coins to satisfy amount of 50 & extra occupation from the change output
      expect(resultTx.inputs.length).toBe(3); // 1 non-Coin + 2 Coin

      // Verify Coin amount is satisfied
      const inputAmount = await coin.getInputsAmount(resultTx);
      expect(inputAmount).toBe(ccc.numFrom(200));
    });
  });

  describe("infoFrom", () => {
    let validCoin1: ccc.CellAny;
    let validCoin2: ccc.CellAny;
    let nonCoin: ccc.CellAny;
    let otherCoin: ccc.CellAny;

    beforeEach(async () => {
      validCoin1 = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(142),
          lock,
          type,
        },
        outputData: ccc.numLeToBytes(100, 16), // amount: 100
      });

      validCoin2 = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(200),
          lock,
          type,
        },
        outputData: ccc.numLeToBytes(250, 16), // amount: 250
      });

      nonCoin = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(500),
          lock,
        },
        outputData: "0x",
      });

      const otherCoinScript = await ccc.Script.fromKnownScript(
        client,
        ccc.KnownScript.XUdt,
        "0x" + "1".repeat(64),
      );
      otherCoin = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(142),
          lock,
          type: otherCoinScript,
        },
        outputData: ccc.numLeToBytes(1000, 16), // amount: 1000 (other Coin)
      });
    });

    it("should return zero for an empty list", async () => {
      const info = await coin.infoFrom([]);
      expect(info.amount).toBe(ccc.Zero);
      expect(info.capacity).toBe(ccc.Zero);
      expect(info.count).toBe(0);
    });

    it("should correctly calculate info for a list of valid Coins", async () => {
      const info = await coin.infoFrom([validCoin1, validCoin2]);
      expect(info.amount).toBe(ccc.numFrom(350)); // 100 + 250
      expect(info.capacity).toBe(ccc.fixedPointFrom(342)); // 142 + 200
      expect(info.count).toBe(2);
    });

    it("should ignore non-Coins and Coins of other types", async () => {
      const info = await coin.infoFrom([validCoin1, nonCoin, otherCoin]);
      expect(info.amount).toBe(ccc.numFrom(100));
      expect(info.capacity).toBe(ccc.fixedPointFrom(142));
      expect(info.count).toBe(1);
    });

    it("should accept a single cell (not an array)", async () => {
      const info = await coin.infoFrom(validCoin1);
      expect(info.amount).toBe(ccc.numFrom(100));
      expect(info.count).toBe(1);
    });

    it("should accept an async iterable", async () => {
      async function* gen() {
        yield validCoin1;
        yield validCoin2;
      }
      const info = await coin.infoFrom(gen());
      expect(info.amount).toBe(ccc.numFrom(350));
      expect(info.count).toBe(2);
    });

    it("should accumulate onto an initial acc value", async () => {
      const info = await coin.infoFrom([validCoin1], {
        amount: ccc.numFrom(500),
        capacity: ccc.fixedPointFrom(10),
        count: 3,
      });
      expect(info.amount).toBe(ccc.numFrom(600)); // 500 + 100
      expect(info.capacity).toBe(ccc.fixedPointFrom(152)); // 10 + 142
      expect(info.count).toBe(4); // 3 + 1
    });

    it("should exclude a cell with correct type but fewer than 16 bytes of data", async () => {
      const shortDataCell = ccc.CellAny.from({
        cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
        outputData: "0x0102030405060708090a0b0c0d0e0f", // only 15 bytes
      });
      const info = await coin.infoFrom([shortDataCell]);
      expect(info.count).toBe(0);
      expect(info.amount).toBe(ccc.Zero);
    });
  });

  describe("isCoin", () => {
    it("should return true for a valid Coin cell", async () => {
      const cell = ccc.CellAny.from({
        cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
        outputData: ccc.numLeToBytes(100, 16),
      });
      expect(await coin.isCoin(cell)).toBe(true);
    });

    it("should return false when cell has no type script", async () => {
      const cell = ccc.CellAny.from({
        cellOutput: { capacity: ccc.fixedPointFrom(142), lock },
        outputData: ccc.numLeToBytes(100, 16),
      });
      expect(await coin.isCoin(cell)).toBe(false);
    });

    it("should return false when type script does not match", async () => {
      const otherType = ccc.Script.from({
        codeHash: "0x" + "ab".repeat(32),
        hashType: "type",
        args: "0x",
      });
      const cell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(142),
          lock,
          type: otherType,
        },
        outputData: ccc.numLeToBytes(100, 16),
      });
      expect(await coin.isCoin(cell)).toBe(false);
    });

    it("should return false when outputData is fewer than 16 bytes", async () => {
      const cell = ccc.CellAny.from({
        cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
        outputData: "0x0102030405060708090a0b0c0d0e0f", // 15 bytes
      });
      expect(await coin.isCoin(cell)).toBe(false);
    });
  });

  describe("amountFromUnsafe", () => {
    it("should decode a 16-byte little-endian uint128", () => {
      const data = ccc.numLeToBytes(12345n, 16);
      expect(Coin.amountFromUnsafe(data)).toBe(ccc.numFrom(12345n));
    });

    it("should return 0 when data is fewer than 16 bytes", () => {
      expect(Coin.amountFromUnsafe("0x010203")).toBe(ccc.Zero);
      expect(Coin.amountFromUnsafe("0x")).toBe(ccc.Zero);
    });

    it("should use only the first 16 bytes when data is longer", () => {
      // First 16 bytes encode 100, remaining bytes are arbitrary
      const first16 = ccc.bytesFrom(ccc.numLeToBytes(100n, 16));
      const extra = new Uint8Array([0xff, 0xff]);
      const combined = ccc.hexFrom(new Uint8Array([...first16, ...extra]));
      expect(Coin.amountFromUnsafe(combined)).toBe(ccc.numFrom(100n));
    });
  });

  describe("getAmountBurned / getInfoBurned", () => {
    it("should return positive value when inputs exceed outputs (tokens burned)", async () => {
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return ccc.Cell.from({
          outPoint: ccc.OutPoint.from(outPoint),
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(300, 16), // amount: 300
        });
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: { txHash: "0x" + "0".repeat(64), index: 0 } },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // amount: 100
      });

      const burned = await coin.getAmountBurned(tx);
      expect(burned).toBe(ccc.numFrom(200)); // 300 - 100
    });

    it("should return 0 when inputs equal outputs (balanced)", async () => {
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return ccc.Cell.from({
          outPoint: ccc.OutPoint.from(outPoint),
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        });
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: { txHash: "0x" + "0".repeat(64), index: 0 } },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      expect(await coin.getAmountBurned(tx)).toBe(ccc.Zero);
    });

    it("should return negative value when outputs exceed inputs (minting)", async () => {
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return ccc.Cell.from({
          outPoint: ccc.OutPoint.from(outPoint),
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        });
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: { txHash: "0x" + "0".repeat(64), index: 0 } },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(500, 16)], // amount: 500 > 100
      });

      const burned = await coin.getAmountBurned(tx);
      expect(burned).toBe(ccc.numFrom(-400n)); // 100 - 500
    });

    it("getInfoBurned should aggregate amount, capacity, and count", async () => {
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return ccc.Cell.from({
          outPoint: ccc.OutPoint.from(outPoint),
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(300, 16),
        });
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: { txHash: "0x" + "0".repeat(64), index: 0 } },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const info = await coin.getInfoBurned(tx);
      expect(info.amount).toBe(ccc.numFrom(200)); // 300 - 100
      expect(info.capacity).toBe(
        ccc.fixedPointFrom(200) - ccc.fixedPointFrom(142),
      ); // input cap - output min cap
      expect(info.count).toBe(0); // 1 input - 1 output
    });
  });

  describe("calculateBalance", () => {
    it("should return total balance from chain source by default", async () => {
      vi.spyOn(signer, "findCellsOnChain").mockImplementation(
        async function* () {
          yield ccc.Cell.from({
            outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
            cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
            outputData: ccc.numLeToBytes(400, 16),
          });
        },
      );

      const balance = await coin.calculateBalance(signer);
      expect(balance).toBe(ccc.numFrom(400));
    });

    it("should return total balance from local source when specified", async () => {
      vi.spyOn(signer, "findCells").mockImplementation(async function* () {
        yield ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(250, 16),
        });
      });

      const balance = await coin.calculateBalance(signer, { source: "local" });
      expect(balance).toBe(ccc.numFrom(250));
    });
  });

  describe("Coin constructor", () => {
    it("should apply a custom filter instead of the default one", async () => {
      const customFilter = ccc.ClientIndexerSearchKeyFilter.from({
        script: type,
        outputDataLenRange: [32, "0xffffffff"],
      });
      const customCoin = new Coin({
        script: type,
        client,
        filter: customFilter,
        cellDeps: [],
      });
      expect(await customCoin.filter).toEqual(customFilter);
    });

    it("should use the default filter (type script + outputDataLenRange [16, max]) when no filter given", async () => {
      const defaultCoin = new Coin({ script: type, client, cellDeps: [] });
      const filterScript = ccc.Script.from(
        ((await defaultCoin.filter) as { script?: ccc.ScriptLike }).script!,
      );
      expect(filterScript.eq(type)).toBe(true);
    });

    it("client getter returns the provided client", () => {
      const otherClient = new ccc.ClientPublicMainnet();
      const customClientCoin = new Coin({
        script: type,
        client: otherClient,
        cellDeps: [],
      });
      expect(customClientCoin.client).toBe(otherClient);
    });

    it("uses a signer supplied to calculateInfo", async () => {
      const explicitSignerCoin = new Coin({
        script: type,
        client,
        cellDeps: [],
      });
      vi.spyOn(signer, "findCellsOnChain").mockImplementation(
        async function* () {},
      );
      await expect(
        explicitSignerCoin.calculateInfo(signer),
      ).resolves.toBeDefined();
      vi.restoreAllMocks();
    });
  });

  describe("getInputsAmount / getOutputsAmount edge cases", () => {
    it("getInputsAmount should return 0 for an empty transaction", async () => {
      const tx = ccc.Transaction.from({});
      expect(await coin.getInputsAmount(tx)).toBe(ccc.Zero);
    });

    it("getOutputsAmount should return 0 for an empty transaction", async () => {
      const tx = ccc.Transaction.from({});
      expect(await coin.getOutputsAmount(tx)).toBe(ccc.Zero);
    });
  });

  describe("completeInputsByAmount edge cases", () => {
    beforeEach(() => {
      const mockCoins = Array.from({ length: 3 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"c".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100 each
        }),
      );

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockCoins.find((c) => c.outPoint.eq(outPoint));
      });
    });

    it("should add no inputs when amountTweak exactly cancels the output requirement", async () => {
      // Output needs 100, but amountTweak is -100 (negative tweak zeroing requirement)
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: {
              txHash: `0x${"c".repeat(63)}0`,
              index: 0,
            },
          },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      // Already have 1 input (amount 100) matching output exactly → no more needed
      const { addedCount } = await coin.completeInputsByAmount(signer, tx);
      expect(addedCount).toBe(0);
    });
  });

  describe("calculateInfo", () => {
    let mockCoins: ccc.Cell[];

    beforeEach(() => {
      mockCoins = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "a".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "b".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(250, 16), // amount: 250
        }),
      ];
    });

    it("should calculate info from local source", async () => {
      const findCellsSpy = vi
        .spyOn(signer, "findCells")
        .mockImplementation(async function* () {
          for (const cell of mockCoins) {
            yield cell;
          }
        });

      const info = await coin.calculateInfo(signer, { source: "local" });

      expect(info.amount).toBe(ccc.numFrom(350));
      expect(info.capacity).toBe(ccc.fixedPointFrom(342));
      expect(info.count).toBe(2);
      expect(findCellsSpy).toHaveBeenCalledWith(await coin.filter);
    });

    it("should calculate info from chain source", async () => {
      const findCellsOnChainSpy = vi
        .spyOn(signer, "findCellsOnChain")
        .mockImplementation(async function* () {
          for (const cell of mockCoins) {
            yield cell;
          }
        });

      const info = await coin.calculateInfo(signer, { source: "chain" });

      expect(info.amount).toBe(ccc.numFrom(350));
      expect(info.capacity).toBe(ccc.fixedPointFrom(342));
      expect(info.count).toBe(2);
      expect(findCellsOnChainSpy).toHaveBeenCalledWith(await coin.filter);
    });
  });

  describe("KnownScript construction", () => {
    it("should initialize with knownScript correctly", async () => {
      const getKnownScriptSpy = vi.spyOn(client, "getKnownScript");

      const coinKnown = new Coin({
        knownScript: ccc.KnownScript.SUdt,
        script: {
          args: lock.hash(),
        },
        client,
      });

      const script = await coinKnown.script;
      const resolvedCellDeps = await coinKnown.cellDeps;

      expect(getKnownScriptSpy).toHaveBeenCalledWith(ccc.KnownScript.SUdt);

      const expectedSUdtInfo = await client.getKnownScript(
        ccc.KnownScript.SUdt,
      );
      expect(script.codeHash).toBe(expectedSUdtInfo.codeHash);
      expect(script.hashType).toBe(expectedSUdtInfo.hashType);
      expect(script.args).toBe(lock.hash());
      expect(resolvedCellDeps.length).toBe(1);
      expect(resolvedCellDeps[0].outPoint.txHash).toBe(
        expectedSUdtInfo.cellDeps[0].cellDep.outPoint.txHash,
      );
    });

    it("should append custom cellDeps after the knownScript's cellDeps", async () => {
      const customCellDep = {
        outPoint: {
          txHash: "0x" + "c".repeat(64),
          index: 0,
        },
        depType: "code" as const,
      };

      const coinKnown = new Coin({
        knownScript: ccc.KnownScript.SUdt,
        script: {
          args: lock.hash(),
        },
        cellDeps: [customCellDep],
        client,
      });

      const resolvedCellDeps = await coinKnown.cellDeps;
      const expectedSUdtInfo = await client.getKnownScript(
        ccc.KnownScript.SUdt,
      );

      // Total cell deps should be 2 (knownScript's cell dep + our custom cell dep)
      expect(resolvedCellDeps.length).toBe(2);
      // The first one is knownScript's cell dep
      expect(resolvedCellDeps[0].outPoint.txHash).toBe(
        expectedSUdtInfo.cellDeps[0].cellDep.outPoint.txHash,
      );
      // The second one is our custom cell dep
      expect(resolvedCellDeps[1].outPoint.txHash).toBe(
        customCellDep.outPoint.txHash,
      );
    });

    it("should prefer explicit script over knownScript shorthand", async () => {
      const explicitScript = {
        codeHash: ("0x" + "a".repeat(64)) as ccc.Hex,
        hashType: "type" as const,
        args: lock.hash(),
      };
      const customCellDep = {
        outPoint: {
          txHash: "0x" + "c".repeat(64),
          index: 0,
        },
        depType: "code" as const,
      };
      const getKnownScriptSpy = vi.spyOn(client, "getKnownScript");

      const coinKnown = new Coin({
        knownScript: ccc.KnownScript.SUdt,
        script: explicitScript,
        cellDeps: [customCellDep],
        client,
      });

      expect(await coinKnown.script).toEqual(ccc.Script.from(explicitScript));
      expect(await coinKnown.cellDeps).toEqual([
        ccc.CellDep.from(customCellDep),
      ]);
      expect(getKnownScriptSpy).not.toHaveBeenCalled();
    });
  });

  describe("transfer", () => {
    it("should add outputs correctly", async () => {
      const recipientLock1 = (await signer.getRecommendedAddressObj()).script;
      const recipientLock2 = (await signer.getRecommendedAddressObj()).script;

      const { tx, outputIndexes } = await coin.transfer([
        { to: recipientLock1, amount: 100n },
        { to: recipientLock2, amount: 200n },
      ]);

      // Verify outputs were added correctly
      expect(tx.outputs.length).toBe(2);
      expect(tx.outputs[0].lock.eq(recipientLock1)).toBe(true);
      expect(tx.outputs[0].type?.eq(await coin.script)).toBe(true);
      expect(tx.outputs[1].lock.eq(recipientLock2)).toBe(true);
      expect(tx.outputs[1].type?.eq(await coin.script)).toBe(true);

      expect(tx.outputsData.length).toBe(2);
      expect(await coin.amountFrom(tx.getOutput(0)!)).toBe(100n);
      expect(await coin.amountFrom(tx.getOutput(1)!)).toBe(200n);

      expect(outputIndexes).toEqual([0, 1]);

      const actions = (await coin.coBuild).findActions(tx, await coin.script);
      expect(actions.length).toBe(2);

      const decodedTransfers = actions.map((action) =>
        CoinAction.fromBytes(action.data).match({
          Transfer: (transfer) => transfer,
          _: () => {
            throw new Error("Expected a Transfer CoinAction");
          },
        }),
      );
      expect(decodedTransfers[0].amount).toBe(100n);
      expect(decodedTransfers[0].to?.eq(recipientLock1)).toBe(true);
      expect(decodedTransfers[1].amount).toBe(200n);
      expect(decodedTransfers[1].to?.eq(recipientLock2)).toBe(true);
    });

    it("should apply outputTransformer to transfer outputs", async () => {
      const recipientLock = (await signer.getRecommendedAddressObj()).script;

      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: async (cell) => {
          return {
            ...cell,
            outputData: ccc.hexFrom(
              ccc.bytesConcat(
                ccc.bytesFrom(cell.outputData),
                new Uint8Array([0xaa, 0xbb]),
              ),
            ),
          };
        },
      });

      const { tx } = await coinWithTransformer.transfer([
        { to: recipientLock, amount: 100n },
      ]);

      expect(tx.outputs.length).toBe(1);
      expect(tx.outputs[0].lock.eq(recipientLock)).toBe(true);
      expect(tx.outputs[0].type?.eq(await coinWithTransformer.script)).toBe(
        true,
      );
      expect(ccc.bytesFrom(tx.outputsData[0]).length).toBe(16 + 2);
      expect(ccc.hexFrom(ccc.bytesFrom(tx.outputsData[0]).slice(16))).toBe(
        "0xaabb",
      );
    });
  });

  describe("mint", () => {
    it("should mint correctly", async () => {
      const recipientLock = (await signer.getRecommendedAddressObj()).script;

      const { tx, outputIndexes } = await coin.mint([
        { to: recipientLock, amount: 100n },
      ]);

      expect(tx.outputs.length).toBe(1);
      expect(tx.outputs[0].lock.eq(recipientLock)).toBe(true);
      expect(tx.outputs[0].type?.eq(await coin.script)).toBe(true);
      expect(await coin.amountFrom(tx.getOutput(0)!)).toBe(100n);
      expect(outputIndexes).toEqual([0]);

      // Verify the public helper injects a correctly wrapped CoinAction.
      const actions = (await coin.coBuild).findActions(tx, await coin.script);
      expect(actions.length).toBe(1);
      CoinAction.fromBytes(actions[0].data).match({
        Mint: (mint) => {
          expect(mint.amount).toBe(100n);
          expect(mint.to?.eq(recipientLock)).toBe(true);
        },
        _: () => {
          throw new Error("Expected a Mint CoinAction");
        },
      });
      expect(await coin.getIntendedAmountBurned(tx)).toBe(-100n);
    });

    it("should apply outputTransformer to mint output", async () => {
      const coinWithTransformer = new Coin({
        script: type,
        client,
        cellDeps: [],
        outputTransformer: async (cell) => {
          return {
            ...cell,
            outputData: ccc.hexFrom(
              ccc.bytesConcat(
                ccc.bytesFrom(cell.outputData),
                new Uint8Array([0x11, 0x22]),
              ),
            ),
          };
        },
      });
      const recipientLock = (await signer.getRecommendedAddressObj()).script;

      const { tx } = await coinWithTransformer.mint([
        { to: recipientLock, amount: 100n },
      ]);

      expect(tx.outputs.length).toBe(1);
      expect(ccc.bytesFrom(tx.outputsData[0]).length).toBe(16 + 2);
      expect(ccc.hexFrom(ccc.bytesFrom(tx.outputsData[0]).slice(16))).toBe(
        "0x1122",
      );
    });
  });

  describe("burn", () => {
    it("should burn correctly", async () => {
      const { tx } = await coin.burn(100n);

      // Burn should not add outputs
      expect(tx.outputs.length).toBe(0);

      // Verify the public helper injects a correctly wrapped CoinAction.
      const actions = (await coin.coBuild).findActions(tx, await coin.script);
      expect(actions.length).toBe(1);
      CoinAction.fromBytes(actions[0].data).match({
        Burn: (burn) => {
          expect(burn.amount).toBe(100n);
        },
        _: () => {
          throw new Error("Expected a Burn CoinAction");
        },
      });
      expect(await coin.getIntendedAmountBurned(tx)).toBe(100n);
    });
  });

  describe("CoBuild action completion", () => {
    let mockCoins: ccc.Cell[];

    beforeEach(async () => {
      mockCoins = Array.from({ length: 10 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"0".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: {
            capacity: ccc.fixedPointFrom(142),
            lock,
            type,
          },
          outputData: ccc.numLeToBytes(100, 16), // amount: 100
        }),
      );

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockCoins) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockCoins.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });
    });

    it("should calculate intended amount burned from mint and burn transactions", async () => {
      const cobuild = await coin.coBuild;

      // Exercise the public helpers here: they are responsible for wrapping the
      // variant payload in a CoinAction before handing it to CoBuild.
      const { tx: txMint } = await coin.mint([{ amount: 100, to: lock }]);
      const minted = await coin.getIntendedAmountBurned(txMint);
      expect(minted).toBe(ccc.numFrom(-100));

      // CoinAction also permits a Mint payload without the optional `to` field.
      const mintActionWithoutTo = CoinAction.from({
        type: "Mint",
        value: {
          amount: 150,
        },
      });
      const { tx: txMintWithoutTo } = await cobuild.appendActions(
        ccc.Transaction.from({}),
        mintActionWithoutTo,
      );
      const mintedWithoutTo =
        await coin.getIntendedAmountBurned(txMintWithoutTo);
      expect(mintedWithoutTo).toBe(ccc.numFrom(-150));

      const { tx: txBurn } = await coin.burn(50);
      const burned = await coin.getIntendedAmountBurned(txBurn);
      expect(burned).toBe(ccc.numFrom(50));

      const { tx: txBoth } = await coin.burn(50, txMint);
      const both = await coin.getIntendedAmountBurned(txBoth);
      expect(both).toBe(ccc.numFrom(-50)); // -100 + 50 = -50
    });

    it("should completeInputsByAmount with MintAction", async () => {
      const cobuild = await coin.coBuild;
      const mintAction = CoinAction.from({
        type: "Mint",
        value: {
          amount: 100,
          to: lock,
        },
      });
      const baseTx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100
      });
      const { tx } = await cobuild.appendActions(baseTx, mintAction);

      // Since we mint 100 and need 100, addedCount should be 0 (no inputs needed)
      // Pass a negative capacity tweak equal to outputs capacity to avoid sourcing inputs for capacity.
      const { addedCount } = await coin.completeInputsByAmount(
        signer,
        tx,
        ccc.Zero,
        -tx.getOutputsCapacity(),
      );
      expect(addedCount).toBe(0);
      expect(tx.inputs.length).toBe(0);
    });

    it("should completeInputsByAmount with BurnAction", async () => {
      const cobuild = await coin.coBuild;
      const burnAction = CoinAction.from({
        type: "Burn",
        value: {
          amount: 50,
        },
      });
      const baseTx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100
      });
      const { tx } = await cobuild.appendActions(baseTx, burnAction);

      // Need 100 output + 50 burn = 150 total.
      // Since each mock coin is 100, we need 2 inputs (total 200).
      const { addedCount } = await coin.completeInputsByAmount(signer, tx);
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(200));
    });

    it("should completeInputsByAmount with both MintAction and BurnAction", async () => {
      const cobuild = await coin.coBuild;
      const mintAction = CoinAction.from({
        type: "Mint",
        value: {
          amount: 60,
        },
      });
      const burnAction = CoinAction.from({
        type: "Burn",
        value: {
          amount: 10,
        },
      });
      const baseTx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100
      });
      // Net change requirement = 100 output + 10 burn - 60 mint = 50.
      const { tx } = await cobuild.appendActions(baseTx, [
        mintAction,
        burnAction,
      ]);

      // Need 50 total. 1 mock coin (amount 100) is enough.
      const { addedCount } = await coin.completeInputsByAmount(signer, tx);
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputAmount = await coin.getInputsAmount(tx);
      expect(inputAmount).toBe(ccc.numFrom(100));
    });

    it("should completeChangeToLock with MintAction and BurnAction", async () => {
      const cobuild = await coin.coBuild;
      const mintAction = CoinAction.from({
        type: "Mint",
        value: {
          amount: 80,
          to: lock,
        },
      });
      const burnAction = CoinAction.from({
        type: "Burn",
        value: {
          amount: 30,
        },
      });
      const baseTx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100
      });
      // Net requirement = 100 output + 30 burn - 80 mint = 50.
      const { tx } = await cobuild.appendActions(baseTx, [
        mintAction,
        burnAction,
      ]);

      // Complete change
      const { tx: completedTx } = await coin.completeChangeToLock(
        signer,
        lock,
        tx,
      );

      // Outputs should now have:
      // Index 0: Original output (amount 100)
      // Index 1: Change output (should have 200 input - 50 net requirement = 150)
      expect(completedTx.outputs.length).toBe(2);
      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(ccc.numFrom(150));
    });

    it("should complete the transaction with MintAction and BurnAction in complete", async () => {
      const cobuild = await coin.coBuild;
      const mintAction = CoinAction.from({
        type: "Mint",
        value: {
          amount: 80,
        },
      });
      const burnAction = CoinAction.from({
        type: "Burn",
        value: {
          amount: 30,
        },
      });
      const baseTx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100
      });
      const { tx } = await cobuild.appendActions(baseTx, [
        mintAction,
        burnAction,
      ]);

      // Complete using standard complete method
      const { tx: completedTx } = await coin.complete(
        signer,
        (t, amount) => {
          t.addOutput({ lock, type }, ccc.numLeToBytes(amount, 16));
        },
        tx,
      );

      expect(completedTx.outputs.length).toBe(2);
      const changeAmount = await coin.amountFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(ccc.numFrom(150));
    });
  });
});
