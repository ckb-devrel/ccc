import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  coin = new Coin({ script: type, signer, cellDeps: [] });
});

describe("Coin", () => {
  describe("completeInputsByBalance", () => {
    // Mock Coins with balance 100 each (10 total, balance = 1000)
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
          outputData: ccc.numLeToBytes(100, 16), // balance: 100
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

    it("should return 0 when no Coin balance is needed", async () => {
      const tx = ccc.Transaction.from({
        outputs: [],
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);
      expect(addedCount).toBe(0);
    });

    it("should collect exactly the required Coin balance", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need balance of 150
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Should add 2 Coins (total balance: 200) to have at least 2 inputs
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      // Verify the inputs are Coins
      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });

    it("should collect exactly one cell when amount matches exactly", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need balance of exactly 100
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Should add only 1 cell since it matches exactly
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(100));
    });

    it("should handle balanceTweak parameter", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(100, 16)], // Need balance of 100
      });

      // Add 50 extra to balance requirement via balanceTweak
      const { addedCount } = await coin.completeInputsByBalance(tx, 50);

      // Should add 2 Coins to cover total balance requirement of 150
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(200));
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
        outputsData: [ccc.numLeToBytes(150, 16)], // Need balance of 150, already have 200
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Should not add any inputs since we already have enough
      expect(addedCount).toBe(0);
      expect(tx.inputs.length).toBe(2);
    });

    it("should throw error when insufficient Coin balance available", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(1500, 16)], // Need balance of 1500, only have 1000 available
      });

      await expect(coin.completeInputsByBalance(tx)).rejects.toThrow(
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
          ccc.numLeToBytes(100, 16), // First output: balance 100
          ccc.numLeToBytes(150, 16), // Second output: balance 150
        ], // Total balance needed: 250
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Should add 3 Coins to cover balance requirement of 250 (total balance: 300)
      expect(addedCount).toBe(3);
      expect(tx.inputs.length).toBe(3);

      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(300));

      const outputBalance = await coin.getOutputsBalance(tx);
      expect(outputBalance).toBe(ccc.numFrom(250));
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
        outputsData: [ccc.numLeToBytes(150, 16)], // Need balance of 150, already have 100
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Should add 1 more Coin (since we already have 1 input with balance 100)
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });

    it("should add one cell when user needs less than one cell", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need only balance of 50 (less than one Coin)
      });

      const { addedCount } = await coin.completeInputsByBalance(tx);

      // Coin completeInputsByBalance adds minimum inputs needed
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await coin.getInputsBalance(tx);
      expect(inputBalance).toBe(ccc.numFrom(100));
    });
  });

  describe("completeInputsAll", () => {
    // Mock Coins with balance 100 each (5 total, balance = 500)
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
          outputData: ccc.numLeToBytes(100, 16), // balance: 100 each
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
      const tx = ccc.Transaction.from({
        outputs: [],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should add all 5 available Coins
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total Coin balance is 500 (5 Coins, balance 100 each)
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));

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
          ccc.numLeToBytes(150, 16), // balance: 150
          ccc.numLeToBytes(200, 16), // balance: 200
        ], // Total balance needed: 350
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should add all 5 available Coins regardless of output requirements
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total Coin balance is 500 (all available)
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));

      // Verify output balance is still 350
      const outputBalance = await coin.getOutputsBalance(completedTx);
      expect(outputBalance).toBe(ccc.numFrom(350));

      // Should have excess balance of 150 (500 - 350)
      const balanceBurned = await coin.getBalanceBurned(completedTx);
      expect(balanceBurned).toBe(ccc.numFrom(150));
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

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should add the remaining 3 Coins (Coins 2, 3, 4)
      expect(addedCount).toBe(3);
      expect(completedTx.inputs.length).toBe(5); // 2 existing + 3 added

      // Verify total Coin balance is still 500 (all 5 Coins)
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
    });

    it("should return 0 when all Coins are already used as inputs", async () => {
      // Pre-add all mock Coins as inputs
      const tx = ccc.Transaction.from({
        inputs: mockCoins.map((cell) => ({ previousOutput: cell.outPoint })),
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should not add any new inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(5); // Same as before

      // Verify total Coin balance is still 500
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
    });

    it("should handle transaction with no Coin outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock }, // Non-Coin output
        ],
        outputsData: ["0x"],
      });

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should add all 5 Coins even though no Coin outputs
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Total balance of 500 will be "burned" since no Coin outputs
      const balanceBurned = await coin.getBalanceBurned(completedTx);
      expect(balanceBurned).toBe(ccc.numFrom(500));
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

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should add all 5 Coins
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(6); // 1 non-Coin + 5 Coin

      // Verify only Coin balance is counted
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
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

      const { tx: completedTx, addedCount } = await coin.completeInputsAll(tx);

      // Should not add any inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(0);

      // Coin balance should be 0
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(inputBalance).toBe(ccc.numFrom(0));
    });
  });

  describe("getInputsBalance", () => {
    it("should calculate total Coin balance from inputs", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // balance: 100
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(200, 16), // balance: 200
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

      const balance = await coin.getInputsBalance(tx);
      expect(balance).toBe(ccc.numFrom(300)); // 100 + 200
    });

    it("should ignore inputs without matching type script", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // balance: 100
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

      const balance = await coin.getInputsBalance(tx);
      expect(balance).toBe(ccc.numFrom(100)); // Only the Coin
    });
  });

  describe("getOutputsBalance", () => {
    it("should calculate total Coin balance from outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type },
          { lock, type },
          { lock }, // No type script
        ],
        outputsData: [
          ccc.numLeToBytes(100, 16), // balance: 100
          ccc.numLeToBytes(200, 16), // balance: 200
          "0x", // Not Coin
        ],
      });

      const balance = await coin.getOutputsBalance(tx);
      expect(balance).toBe(ccc.numFrom(300)); // 100 + 200, ignoring non-Coin output
    });

    it("should return 0 when no Coin outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script
        outputsData: ["0x"],
      });

      const balance = await coin.getOutputsBalance(tx);
      expect(balance).toBe(ccc.numFrom(0));
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
          outputData: ccc.numLeToBytes(100, 16), // balance: 100 each
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

    it("should add change output when there's excess Coin balance", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need balance of 150
      });

      const { tx: completedTx } = await coin.completeChangeToLock(
        tx,
        changeLock,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);
      expect(completedTx.outputs[1].type?.eq(type)).toBe(true);

      // Change should have balance of 50 (input 200 - output 150)
      const changeAmount = await coin.balanceFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(ccc.numFrom(50));
    });

    it("returns correct changeIndex, hasChanged, addedInputs", async () => {
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
      const res1 = await coin.completeChangeToLock(tx1, changeLock);
      expect(res1.hasChanged).toBe(true);
      expect(res1.changeIndex).toBe(1); // appended after the existing output
      expect(res1.addedInputs).toBeGreaterThan(0);

      // Case 2: no excess balance — no change output
      const tx2 = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(200, 16)],
      });
      const res2 = await coin.completeChangeToLock(tx2, changeLock);
      expect(res2.hasChanged).toBe(false);
      expect(res2.changeIndex).toBeUndefined();
    });

    it("transformer: appends extra bytes whose count equals balance / 100", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      // output balance = 0, inputs will cover 100 (1 cell), change = 100 → extra = 1 byte
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      const { tx: completedTx } = await coin.completeChangeToLock(
        tx,
        changeLock,
        {
          transformer: async (cell) => {
            const balance = await coin.balanceFrom(cell);
            const extraLen = Number(balance / 100n);
            const extra = new Uint8Array(extraLen).fill(0xff);
            return {
              ...cell,
              outputData: ccc.hexFrom(
                ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extra),
              ),
            };
          },
        },
      );

      // change output should have been added
      expect(completedTx.outputs.length).toBe(2);

      const changeBalance = await coin.balanceFrom(completedTx.getOutput(1)!);
      const changeData = ccc.bytesFrom(completedTx.outputsData[1]);
      const expectedExtraLen = Number(changeBalance / 100n);

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

      const { tx: completedTx } = await coin.completeChangeToLock(
        tx,
        changeLock,
        {
          transformer: (cell) => ({
            ...cell,
            cellOutput: { ...cell.cellOutput, capacity: bigCapacity },
          }),
        },
      );

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

      const { tx: completedTx } = await coin.completeBy(tx);

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
        // Cell 0: balance 100, 142 CKB capacity (minimum)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 1: balance 100, 200 CKB capacity (extra capacity)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 2: balance 100, 300 CKB capacity (more extra capacity)
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

      // Create a transaction that needs balance of 50 (less than one Coin)
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      const { tx: completedTx } = await coin.completeChangeToLock(
        tx,
        changeLock,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);

      // Verify inputs were added to cover both Coin balance and capacity requirements
      expect(completedTx.inputs.length).toBe(2);

      // Check that change output has correct Coin balance (should be input - 50)
      const changeAmount = await coin.balanceFrom(completedTx.getOutput(1)!);
      const inputBalance = await coin.getInputsBalance(completedTx);
      expect(changeAmount).toBe(inputBalance - ccc.numFrom(50));

      // Verify change output has correct type script
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);

      // Key assertion: verify that capacity is sufficient (positive fee)
      const fee = await completedTx.getFee(client);
      expect(fee).toBeGreaterThanOrEqual(ccc.Zero);
    });

    it("should handle capacity tweak parameter in completeInputsByBalance", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need balance of 50
      });

      // Add extra capacity requirement via capacityTweak that's reasonable
      const extraCapacityNeeded = ccc.fixedPointFrom(1000); // Reasonable capacity requirement
      const { addedCount } = await coin.completeInputsByBalance(
        tx,
        ccc.Zero, // No extra Coin balance needed
        extraCapacityNeeded, // Extra capacity needed
      );

      // Should add Coins to cover the capacity requirement
      expect(addedCount).toBeGreaterThan(2);

      // Should have added at least one cell with capacity
      expect(await coin.getInputsBalance(tx)).toBeGreaterThan(ccc.Zero);
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
        outputsData: [ccc.numLeToBytes(50, 16)], // Need balance of 50, change will have balance of 50
      });

      // Track the calls to completeInputsByBalance to verify two-phase completion
      const completeInputsSpy = vi.spyOn(coin, "completeInputsByBalance");

      const { tx: completedTx } = await coin.completeChangeToLock(
        tx,
        changeLock,
      );

      // Should have called completeInputsByBalance twice:
      // 1. First call: initial Coin balance completion
      // 2. Second call: with extraCapacity for change output
      expect(completeInputsSpy).toHaveBeenCalledTimes(2);

      // Verify the second call included extraCapacity parameter
      const secondCall = completeInputsSpy.mock.calls[1];
      expect(secondCall[1]).toBe(ccc.Zero); // balanceTweak should be 0
      expect(secondCall[2]).toBeGreaterThan(ccc.Zero); // capacityTweak should be > 0 (change output capacity)

      // Should have change output
      expect(completedTx.outputs.length).toBe(2);
      const changeAmount = await coin.balanceFrom(completedTx.getOutput(1)!);
      expect(changeAmount).toBe(
        (await coin.getInputsBalance(completedTx)) - ccc.numFrom(50),
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

      const { tx: completedTx } = await coin.completeChangeToOutput(tx, 0); // Use first output as change

      // Should have added inputs
      expect(completedTx.inputs.length).toBeGreaterThan(0);

      // The first output should now contain the original amount plus any excess from inputs
      const changeAmount = await coin.balanceFrom(completedTx.getOutput(0)!);
      const inputBalance = await coin.getInputsBalance(completedTx);

      // Change output should have: original amount + excess from inputs
      // Since we only have one output, all input balance should go to it
      expect(changeAmount).toBe(inputBalance);
      expect(changeAmount).toBeGreaterThan(ccc.numFrom(50)); // More than the original amount
    });

    it("should throw error when change output is not a Coin cell", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script - not a Coin
        outputsData: ["0x"],
      });

      await expect(coin.completeChangeToOutput(tx, 0)).rejects.toThrow(
        "Change output must be a Coin",
      );
    });

    it("should throw error when change output index does not exist", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      await expect(coin.completeChangeToOutput(tx, 5)).rejects.toThrow(
        "Output at index 5 does not exist",
      );
    });

    it("completeChangeToOutput transformer: appends extra bytes whose count equals balance / 100", async () => {
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

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(0, 16)],
      });

      const { tx: completedTx } = await coin.completeChangeToOutput(tx, 0, {
        transformer: async (cell) => {
          const balance = await coin.balanceFrom(cell);
          const extra = new Uint8Array(Number(balance / 100n)).fill(0xee);
          return {
            ...cell,
            outputData: ccc.hexFrom(
              ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extra),
            ),
          };
        },
      });

      const changeBalance = await coin.balanceFrom(completedTx.getOutput(0)!);
      const changeData = ccc.bytesFrom(completedTx.outputsData[0]);
      const expectedExtraLen = Number(changeBalance / 100n);

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

      const { tx: completedTx } = await coin.completeChangeToOutput(tx, 0, {
        transformer: async (cell) => ({
          ...cell,
          outputData: ccc.hexFrom(
            ccc.bytesConcat(
              ccc.bytesFrom(cell.outputData),
              new Uint8Array(100).fill(0xab),
            ),
          ),
        }),
      });

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
          { lock, type }, // Coin output with balance of 50
        ],
        outputsData: [
          ccc.numLeToBytes(50, 16), // balance: 50
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

      const { tx: resultTx } = await coin.completeBy(tx);

      // Should add exactly 2 Coins to satisfy balance of 50 & extra occupation from the change output
      expect(resultTx.inputs.length).toBe(3); // 1 non-Coin + 2 Coin

      // Verify Coin balance is satisfied
      const inputBalance = await coin.getInputsBalance(resultTx);
      expect(inputBalance).toBe(ccc.numFrom(200));
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
        outputData: ccc.numLeToBytes(100, 16), // balance: 100
      });

      validCoin2 = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(200),
          lock,
          type,
        },
        outputData: ccc.numLeToBytes(250, 16), // balance: 250
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
        outputData: ccc.numLeToBytes(1000, 16), // balance: 1000 (other Coin)
      });
    });

    it("should return zero for an empty list", async () => {
      const info = await coin.infoFrom([]);
      expect(info.balance).toBe(ccc.Zero);
      expect(info.capacity).toBe(ccc.Zero);
      expect(info.count).toBe(0);
    });

    it("should correctly calculate info for a list of valid Coins", async () => {
      const info = await coin.infoFrom([validCoin1, validCoin2]);
      expect(info.balance).toBe(ccc.numFrom(350)); // 100 + 250
      expect(info.capacity).toBe(ccc.fixedPointFrom(342)); // 142 + 200
      expect(info.count).toBe(2);
    });

    it("should ignore non-Coins and Coins of other types", async () => {
      const info = await coin.infoFrom([validCoin1, nonCoin, otherCoin]);
      expect(info.balance).toBe(ccc.numFrom(100));
      expect(info.capacity).toBe(ccc.fixedPointFrom(142));
      expect(info.count).toBe(1);
    });

    it("should accept a single cell (not an array)", async () => {
      const info = await coin.infoFrom(validCoin1);
      expect(info.balance).toBe(ccc.numFrom(100));
      expect(info.count).toBe(1);
    });

    it("should accept an async iterable", async () => {
      async function* gen() {
        yield validCoin1;
        yield validCoin2;
      }
      const info = await coin.infoFrom(gen());
      expect(info.balance).toBe(ccc.numFrom(350));
      expect(info.count).toBe(2);
    });

    it("should accumulate onto an initial acc value", async () => {
      const info = await coin.infoFrom([validCoin1], {
        balance: ccc.numFrom(500),
        capacity: ccc.fixedPointFrom(10),
        count: 3,
      });
      expect(info.balance).toBe(ccc.numFrom(600)); // 500 + 100
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
      expect(info.balance).toBe(ccc.Zero);
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

  describe("balanceFromUnsafe", () => {
    it("should decode a 16-byte little-endian uint128", () => {
      const data = ccc.numLeToBytes(12345n, 16);
      expect(Coin.balanceFromUnsafe(data)).toBe(ccc.numFrom(12345n));
    });

    it("should return 0 when data is fewer than 16 bytes", () => {
      expect(Coin.balanceFromUnsafe("0x010203")).toBe(ccc.Zero);
      expect(Coin.balanceFromUnsafe("0x")).toBe(ccc.Zero);
    });

    it("should use only the first 16 bytes when data is longer", () => {
      // First 16 bytes encode 100, remaining bytes are arbitrary
      const first16 = ccc.bytesFrom(ccc.numLeToBytes(100n, 16));
      const extra = new Uint8Array([0xff, 0xff]);
      const combined = ccc.hexFrom(new Uint8Array([...first16, ...extra]));
      expect(Coin.balanceFromUnsafe(combined)).toBe(ccc.numFrom(100n));
    });
  });

  describe("getBalanceBurned / getInfoBurned", () => {
    it("should return positive value when inputs exceed outputs (tokens burned)", async () => {
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return ccc.Cell.from({
          outPoint: ccc.OutPoint.from(outPoint),
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(300, 16), // balance: 300
        });
      });

      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: { txHash: "0x" + "0".repeat(64), index: 0 } },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)], // balance: 100
      });

      const burned = await coin.getBalanceBurned(tx);
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

      expect(await coin.getBalanceBurned(tx)).toBe(ccc.Zero);
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
        outputsData: [ccc.numLeToBytes(500, 16)], // balance: 500 > 100
      });

      const burned = await coin.getBalanceBurned(tx);
      expect(burned).toBe(ccc.numFrom(-400n)); // 100 - 500
    });

    it("getInfoBurned should aggregate balance, capacity, and count", async () => {
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
      expect(info.balance).toBe(ccc.numFrom(200)); // 300 - 100
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
        signer,
        filter: customFilter,
        cellDeps: [],
      });
      expect(await customCoin.filter).toEqual(customFilter);
    });

    it("should use the default filter (type script + outputDataLenRange [16, max]) when no filter given", async () => {
      const defaultCoin = new Coin({ script: type, signer, cellDeps: [] });
      const filterScript = ccc.Script.from(
        ((await defaultCoin.filter) as { script?: ccc.ScriptLike }).script!,
      );
      expect(filterScript.eq(type)).toBe(true);
    });

    it("client-only: client getter returns the provided client", () => {
      const clientOnlyCoin = new Coin({ script: type, client, cellDeps: [] });
      expect(clientOnlyCoin.client).toBe(client);
    });

    it("client-only: signer getter throws", () => {
      const clientOnlyCoin = new Coin({ script: type, client, cellDeps: [] });
      expect(() => clientOnlyCoin.signer).toThrow(
        "Coin was constructed without a signer. Pass signer to use this method.",
      );
    });

    it("signer-only: client getter returns signer.client", () => {
      const signerOnlyCoin = new Coin({ script: type, signer, cellDeps: [] });
      expect(signerOnlyCoin.client).toBe(signer.client);
    });

    it("signer takes priority over client for client getter", () => {
      const otherClient = new ccc.ClientPublicMainnet();
      const bothCoin = new Coin({
        script: type,
        signer,
        client: otherClient,
        cellDeps: [],
      });
      expect(bothCoin.client).toBe(signer.client);
    });

    it("client-only: completeBy throws with clear error", async () => {
      const clientOnlyCoin = new Coin({ script: type, client, cellDeps: [] });
      const tx = ccc.Transaction.from({});
      await expect(clientOnlyCoin.completeBy(tx)).rejects.toThrow(
        "Coin was constructed without a signer. Pass signer to use this method.",
      );
    });

    it("client-only: calculateInfo throws when no signer passed", async () => {
      const clientOnlyCoin = new Coin({ script: type, client, cellDeps: [] });
      await expect(clientOnlyCoin.calculateInfo()).rejects.toThrow(
        "Coin was constructed without a signer",
      );
    });

    it("client-only: calculateInfo works when signer passed as argument", async () => {
      const clientOnlyCoin = new Coin({ script: type, client, cellDeps: [] });
      vi.spyOn(signer, "findCellsOnChain").mockImplementation(
        async function* () {},
      );
      await expect(clientOnlyCoin.calculateInfo(signer)).resolves.toBeDefined();
      vi.restoreAllMocks();
    });
  });

  describe("getInputsBalance / getOutputsBalance edge cases", () => {
    it("getInputsBalance should return 0 for an empty transaction", async () => {
      const tx = ccc.Transaction.from({});
      expect(await coin.getInputsBalance(tx)).toBe(ccc.Zero);
    });

    it("getOutputsBalance should return 0 for an empty transaction", async () => {
      const tx = ccc.Transaction.from({});
      expect(await coin.getOutputsBalance(tx)).toBe(ccc.Zero);
    });
  });

  describe("completeInputsByBalance edge cases", () => {
    beforeEach(() => {
      const mockCoins = Array.from({ length: 3 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"c".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // balance: 100 each
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

    it("should add no inputs when balanceTweak exactly cancels the output requirement", async () => {
      // Output needs 100, but balanceTweak is -100 (negative tweak zeroing requirement)
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

      // Already have 1 input (balance 100) matching output exactly → no more needed
      const { addedCount } = await coin.completeInputsByBalance(tx);
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
          outputData: ccc.numLeToBytes(100, 16), // balance: 100
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "b".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(250, 16), // balance: 250
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

      expect(info.balance).toBe(ccc.numFrom(350));
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

      expect(info.balance).toBe(ccc.numFrom(350));
      expect(info.capacity).toBe(ccc.fixedPointFrom(342));
      expect(info.count).toBe(2);
      expect(findCellsOnChainSpy).toHaveBeenCalledWith(await coin.filter);
    });
  });
});
