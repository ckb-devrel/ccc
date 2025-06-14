import { ccc } from "@ckb-ccc/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Udt } from "./index.js";

let client: ccc.Client;
let signer: ccc.Signer;
let lock: ccc.Script;
let type: ccc.Script;
let udt: Udt;

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

  // Create UDT instance
  udt = new Udt(
    {
      txHash:
        "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
      index: 0,
    },
    type,
  );
});

describe("Udt", () => {
  describe("completeInputsByBalance", () => {
    // Mock cells with 100 UDT each (10 cells total = 1000 UDT)
    let mockUdtCells: ccc.Cell[];

    beforeEach(async () => {
      // Create mock cells after type is initialized
      mockUdtCells = Array.from({ length: 10 }, (_, i) =>
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
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT tokens
        }),
      );
    });

    beforeEach(() => {
      // Mock the findCells method to return our mock UDT cells
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockUdtCells) {
              yield cell;
            }
          }
        },
      );

      // Mock client.getCell to return the cell data for inputs
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockUdtCells.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });
    });

    it("should return 0 when no UDT balance is needed", async () => {
      const tx = ccc.Transaction.from({
        outputs: [],
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);
      expect(addedCount).toBe(0);
    });

    it("should collect exactly the required UDT balance", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need 150 UDT
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // Should add 2 cells (200 UDT total) to have at least 2 inputs
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      // Verify the inputs are UDT cells
      const inputBalance = await udt.getInputsBalance(client, tx);
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
        outputsData: [ccc.numLeToBytes(100, 16)], // Need exactly 100 UDT
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // Should add only 1 cell since it matches exactly
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await udt.getInputsBalance(client, tx);
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
        outputsData: [ccc.numLeToBytes(100, 16)], // Need 100 UDT
      });

      // Add 50 extra UDT requirement via balanceTweak
      const { addedCount } = await udt.completeInputsByBalance(tx, signer, 50);

      // Should add 2 cells to cover 150 UDT total requirement
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await udt.getInputsBalance(client, tx);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });

    it("should return 0 when existing inputs already satisfy the requirement", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockUdtCells[0].outPoint,
          },
          {
            previousOutput: mockUdtCells[1].outPoint,
          },
        ],
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need 150 UDT, already have 200
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // Should not add any inputs since we already have enough
      expect(addedCount).toBe(0);
      expect(tx.inputs.length).toBe(2);
    });

    it("should throw error when insufficient UDT balance available", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(1500, 16)], // Need 1500 UDT, only have 1000 available
      });

      await expect(udt.completeInputsByBalance(tx, signer)).rejects.toThrow(
        "Insufficient coin, need 500 extra coin",
      );
    });

    it("should handle multiple UDT outputs correctly", async () => {
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
          ccc.numLeToBytes(100, 16), // First output: 100 UDT
          ccc.numLeToBytes(150, 16), // Second output: 150 UDT
        ], // Total: 250 UDT needed
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // Should add 3 cells to cover 250 UDT requirement (300 UDT total)
      expect(addedCount).toBe(3);
      expect(tx.inputs.length).toBe(3);

      const inputBalance = await udt.getInputsBalance(client, tx);
      expect(inputBalance).toBe(ccc.numFrom(300));

      const outputBalance = await udt.getOutputsBalance(client, tx);
      expect(outputBalance).toBe(ccc.numFrom(250));
    });

    it("should skip cells that are already used as inputs", async () => {
      // Pre-add one of the mock cells as input
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockUdtCells[0].outPoint,
          },
        ],
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need 150 UDT, already have 100
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // Should add 1 more cell (since we already have 1 input with 100 UDT)
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await udt.getInputsBalance(client, tx);
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
        outputsData: [ccc.numLeToBytes(50, 16)], // Need only 50 UDT (less than one cell)
      });

      const { addedCount } = await udt.completeInputsByBalance(tx, signer);

      // UDT completeInputsByBalance adds minimum inputs needed
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await udt.getInputsBalance(client, tx);
      expect(inputBalance).toBe(ccc.numFrom(100));
    });
  });

  describe("completeInputsAll", () => {
    // Mock cells with 100 UDT each (5 cells total = 500 UDT)
    let mockUdtCells: ccc.Cell[];

    beforeEach(async () => {
      // Create mock cells after type is initialized
      mockUdtCells = Array.from({ length: 5 }, (_, i) =>
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
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT tokens each
        }),
      );
    });

    beforeEach(() => {
      // Mock the findCells method to return our mock UDT cells
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockUdtCells) {
              yield cell;
            }
          }
        },
      );

      // Mock client.getCell to return the cell data for inputs
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockUdtCells.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });
    });

    it("should add all available UDT cells to empty transaction", async () => {
      const tx = ccc.Transaction.from({
        outputs: [],
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should add all 5 available UDT cells
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total UDT balance is 500 (5 cells × 100 UDT each)
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));

      // Verify all cells were added by checking outpoints
      const addedOutpoints = completedTx.inputs.map(
        (input) => input.previousOutput,
      );
      for (const cell of mockUdtCells) {
        expect(addedOutpoints.some((op) => op.eq(cell.outPoint))).toBe(true);
      }
    });

    it("should add all available UDT cells to transaction with outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type },
          { lock, type },
        ],
        outputsData: [
          ccc.numLeToBytes(150, 16), // 150 UDT
          ccc.numLeToBytes(200, 16), // 200 UDT
        ], // Total: 350 UDT needed
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should add all 5 available UDT cells regardless of output requirements
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // Verify total UDT balance is 500 (all available)
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));

      // Verify output balance is still 350
      const outputBalance = await udt.getOutputsBalance(client, completedTx);
      expect(outputBalance).toBe(ccc.numFrom(350));

      // Should have 150 UDT excess balance (500 - 350)
      const balanceBurned = await udt.getBalanceBurned(client, completedTx);
      expect(balanceBurned).toBe(ccc.numFrom(150));
    });

    it("should skip cells already used as inputs", async () => {
      // Pre-add 2 of the mock cells as inputs
      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: mockUdtCells[0].outPoint },
          { previousOutput: mockUdtCells[1].outPoint },
        ],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should add the remaining 3 cells (cells 2, 3, 4)
      expect(addedCount).toBe(3);
      expect(completedTx.inputs.length).toBe(5); // 2 existing + 3 added

      // Verify total UDT balance is still 500 (all 5 cells)
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
    });

    it("should return 0 when all UDT cells are already used as inputs", async () => {
      // Pre-add all mock cells as inputs
      const tx = ccc.Transaction.from({
        inputs: mockUdtCells.map((cell) => ({ previousOutput: cell.outPoint })),
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should not add any new inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(5); // Same as before

      // Verify total UDT balance is still 500
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
    });

    it("should handle transaction with no UDT outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock }, // Non-UDT output
        ],
        outputsData: ["0x"],
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should add all 5 UDT cells even though no UDT outputs
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(5);

      // All 500 UDT will be "burned" since no UDT outputs
      const balanceBurned = await udt.getBalanceBurned(client, completedTx);
      expect(balanceBurned).toBe(ccc.numFrom(500));
    });

    it("should work with mixed input types", async () => {
      // Create a non-UDT cell
      const nonUdtCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "f".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(1000),
          lock,
          // No type script
        },
        outputData: "0x",
      });

      // Pre-add the non-UDT cell as input
      const tx = ccc.Transaction.from({
        inputs: [{ previousOutput: nonUdtCell.outPoint }],
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      // Mock getCell to handle both UDT and non-UDT cells
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const outPointObj = ccc.OutPoint.from(outPoint);
        if (outPointObj.eq(nonUdtCell.outPoint)) {
          return nonUdtCell;
        }
        return mockUdtCells.find((c) => c.outPoint.eq(outPointObj));
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should add all 5 UDT cells
      expect(addedCount).toBe(5);
      expect(completedTx.inputs.length).toBe(6); // 1 non-UDT + 5 UDT

      // Verify only UDT balance is counted
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(500));
    });

    it("should handle empty cell collection gracefully", async () => {
      // Mock findCells to return no cells
      vi.spyOn(signer, "findCells").mockImplementation(async function* () {
        // Return no cells
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(100, 16)],
      });

      const { tx: completedTx, addedCount } = await udt.completeInputsAll(
        tx,
        signer,
      );

      // Should not add any inputs
      expect(addedCount).toBe(0);
      expect(completedTx.inputs.length).toBe(0);

      // UDT balance should be 0
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(inputBalance).toBe(ccc.numFrom(0));
    });
  });

  describe("getInputsBalance", () => {
    it("should calculate total UDT balance from inputs", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(200, 16), // 200 UDT
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

      const balance = await udt.getInputsBalance(client, tx);
      expect(balance).toBe(ccc.numFrom(300)); // 100 + 200
    });

    it("should ignore inputs without matching type script", async () => {
      const mockCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT
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

      const balance = await udt.getInputsBalance(client, tx);
      expect(balance).toBe(ccc.numFrom(100)); // Only the UDT cell
    });
  });

  describe("getOutputsBalance", () => {
    it("should calculate total UDT balance from outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type },
          { lock, type },
          { lock }, // No type script
        ],
        outputsData: [
          ccc.numLeToBytes(100, 16), // 100 UDT
          ccc.numLeToBytes(200, 16), // 200 UDT
          "0x", // Not UDT
        ],
      });

      const balance = await udt.getOutputsBalance(client, tx);
      expect(balance).toBe(ccc.numFrom(300)); // 100 + 200, ignoring non-UDT output
    });

    it("should return 0 when no UDT outputs", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script
        outputsData: ["0x"],
      });

      const balance = await udt.getOutputsBalance(client, tx);
      expect(balance).toBe(ccc.numFrom(0));
    });
  });

  describe("completeChangeToLock", () => {
    let mockUdtCells: ccc.Cell[];

    beforeEach(() => {
      mockUdtCells = Array.from({ length: 5 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"0".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT each
        }),
      );

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockUdtCells) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockUdtCells.find((c) => c.outPoint.eq(outPoint));
      });
    });

    it("should add change output when there's excess UDT balance", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)], // Need 150 UDT
      });

      const completedTx = await udt.completeChangeToLock(
        tx,
        signer,
        changeLock,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);
      expect(completedTx.outputs[1].type?.eq(type)).toBe(true);

      // Change should be 50 UDT (200 input - 150 output)
      const changeAmount = await udt.balanceFrom(
        client,
        completedTx.getOutput(1)!,
      );
      expect(changeAmount).toBe(ccc.numFrom(50));
    });

    it("should not add change when no excess balance", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(200, 16)], // Need exactly 200 UDT
      });

      const completedTx = await udt.completeChangeToLock(
        tx,
        signer,
        changeLock,
      );

      // Should only have original output
      expect(completedTx.outputs.length).toBe(1);
    });
  });

  describe("completeBy", () => {
    it("should use signer's recommended address for change", async () => {
      const mockUdtCells = Array.from({ length: 3 }, (_, i) =>
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
            for (const cell of mockUdtCells) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockUdtCells.find((c) => c.outPoint.eq(outPoint));
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(150, 16)],
      });

      const completedTx = await udt.completeBy(tx, signer);

      // Should have change output with signer's lock
      expect(completedTx.outputs.length).toBe(2);
      expect(completedTx.outputs[1].lock.eq(lock)).toBe(true); // Same as signer's lock
    });
  });

  describe("complete method with capacity handling", () => {
    let mockUdtCells: ccc.Cell[];

    beforeEach(() => {
      // Create mock cells with different capacity values
      mockUdtCells = [
        // Cell 0: 100 UDT, 142 CKB capacity (minimum for UDT cell)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 1: 100 UDT, 200 CKB capacity (extra capacity)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "1".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
        // Cell 2: 100 UDT, 300 CKB capacity (more extra capacity)
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "2".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(300), lock, type },
          outputData: ccc.numLeToBytes(100, 16),
        }),
      ];

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of mockUdtCells) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return mockUdtCells.find((c) => c.outPoint.eq(outPoint));
      });
    });

    it("should add extra UDT cells when change output requires additional capacity", async () => {
      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      // Create a transaction that needs 50 UDT (less than one cell)
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      const completedTx = await udt.completeChangeToLock(
        tx,
        signer,
        changeLock,
      );

      // Should have original output + change output
      expect(completedTx.outputs.length).toBe(2);

      // Verify inputs were added to cover both UDT balance and capacity requirements
      expect(completedTx.inputs.length).toBe(2);

      // Check that change output has correct UDT balance (should be input - 50)
      const changeAmount = await udt.balanceFrom(
        client,
        completedTx.getOutput(1)!,
      );
      const inputBalance = await udt.getInputsBalance(client, completedTx);
      expect(changeAmount).toBe(inputBalance - ccc.numFrom(50));

      // Verify change output has correct type script
      expect(completedTx.outputs[1].type?.eq(type)).toBe(true);
      expect(completedTx.outputs[1].lock.eq(changeLock)).toBe(true);

      // Key assertion: verify that capacity is sufficient (positive fee)
      const fee = await completedTx.getFee(client);
      expect(fee).toBeGreaterThanOrEqual(ccc.Zero);
    });

    it("should handle capacity tweak parameter in completeInputsByBalance", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need 50 UDT
      });

      // Add extra capacity requirement via capacityTweak that's reasonable
      const extraCapacityNeeded = ccc.fixedPointFrom(1000); // Reasonable capacity requirement
      const { addedCount } = await udt.completeInputsByBalance(
        tx,
        signer,
        ccc.Zero, // No extra UDT balance needed
        extraCapacityNeeded, // Extra capacity needed
      );

      // Should add cells to cover the capacity requirement
      expect(addedCount).toBeGreaterThan(2);

      // Should have added at least one cell with capacity
      expect(await udt.getInputsBalance(client, tx)).toBeGreaterThan(ccc.Zero);
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
        outputsData: [ccc.numLeToBytes(50, 16)], // Need 50 UDT, will have 50 UDT change
      });

      // Track the calls to completeInputsByBalance to verify two-phase completion
      const completeInputsByBalanceSpy = vi.spyOn(
        udt,
        "completeInputsByBalance",
      );

      const completedTx = await udt.completeChangeToLock(
        tx,
        signer,
        changeLock,
      );

      // Should have called completeInputsByBalance twice:
      // 1. First call: initial UDT balance completion
      // 2. Second call: with extraCapacity for change output
      expect(completeInputsByBalanceSpy).toHaveBeenCalledTimes(2);

      // Verify the second call included extraCapacity parameter
      const secondCall = completeInputsByBalanceSpy.mock.calls[1];
      expect(secondCall[2]).toBe(ccc.Zero); // balanceTweak should be 0
      expect(secondCall[3]).toBeGreaterThan(ccc.Zero); // capacityTweak should be > 0 (change output capacity)

      // Should have change output
      expect(completedTx.outputs.length).toBe(2);
      const changeAmount = await udt.balanceFrom(
        client,
        completedTx.getOutput(1)!,
      );
      expect(changeAmount).toBe(
        (await udt.getInputsBalance(client, completedTx)) - ccc.numFrom(50),
      ); // 100 input - 50 output = 50 change

      completeInputsByBalanceSpy.mockRestore();
    });

    it("should handle completeChangeToOutput correctly", async () => {
      // Create a transaction with an existing UDT output that will receive change
      const tx = ccc.Transaction.from({
        outputs: [
          { lock, type }, // This will be the change output
        ],
        outputsData: [
          ccc.numLeToBytes(50, 16), // Initial amount in change output
        ],
      });

      const completedTx = await udt.completeChangeToOutput(tx, signer, 0); // Use first output as change

      // Should have added inputs
      expect(completedTx.inputs.length).toBeGreaterThan(0);

      // The first output should now contain the original amount plus any excess from inputs
      const changeAmount = await udt.balanceFrom(
        client,
        completedTx.getOutput(0)!,
      );
      const inputBalance = await udt.getInputsBalance(client, completedTx);

      // Change output should have: original amount + excess from inputs
      // Since we only have one output, all input balance should go to it
      expect(changeAmount).toBe(inputBalance);
      expect(changeAmount).toBeGreaterThan(ccc.numFrom(50)); // More than the original amount
    });

    it("should throw error when change output is not a UDT cell", async () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }], // No type script - not a UDT cell
        outputsData: ["0x"],
      });

      await expect(udt.completeChangeToOutput(tx, signer, 0)).rejects.toThrow(
        "Change output must be a UDT cell",
      );
    });

    it("should handle insufficient capacity gracefully", async () => {
      // Mock to return cells with very low capacity
      const lowCapacityCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "0".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(61), lock, type }, // Very low capacity
          outputData: ccc.numLeToBytes(100, 16),
        }),
      ];

      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            for (const cell of lowCapacityCells) {
              yield cell;
            }
          }
        },
      );

      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        return lowCapacityCells.find((c) => c.outPoint.eq(outPoint));
      });

      const changeLock = ccc.Script.from({
        codeHash: "0x" + "9".repeat(64),
        hashType: "type",
        args: "0x1234",
      });

      const tx = ccc.Transaction.from({
        outputs: [{ lock, type }],
        outputsData: [ccc.numLeToBytes(50, 16)],
      });

      // Should still complete successfully even with capacity constraints
      // The UDT logic should focus on UDT balance completion
      const completedTx = await udt.completeChangeToLock(
        tx,
        signer,
        changeLock,
      );

      expect(completedTx.inputs.length).toBe(1);
      expect(completedTx.outputs.length).toBe(2); // Original + change

      expect(await completedTx.getFee(client)).toBeLessThan(0n);
    });

    it("should handle capacity calculation when transaction has non-UDT inputs with high capacity", async () => {
      // Create a non-UDT cell with very high capacity
      const nonUdtCell = ccc.Cell.from({
        outPoint: { txHash: "0x" + "f".repeat(64), index: 0 },
        cellOutput: {
          capacity: ccc.fixedPointFrom(10000), // Very high capacity (100 CKB)
          lock,
          // No type script - this is a regular CKB cell
        },
        outputData: "0x", // Empty data
      });

      // Create a transaction that already has the non-UDT input
      const tx = ccc.Transaction.from({
        inputs: [
          { previousOutput: nonUdtCell.outPoint }, // Pre-existing non-UDT input
        ],
        outputs: [
          { lock, type }, // UDT output requiring 50 UDT
        ],
        outputsData: [
          ccc.numLeToBytes(50, 16), // Need 50 UDT
        ],
      });

      // Mock getCell to return both UDT and non-UDT cells
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const outPointObj = ccc.OutPoint.from(outPoint);
        if (outPointObj.eq(nonUdtCell.outPoint)) {
          return nonUdtCell;
        }
        return mockUdtCells.find((c) => c.outPoint.eq(outPointObj));
      });

      const resultTx = await udt.completeBy(tx, signer);

      // Should add exactly 2 UDT cell to satisfy the 50 UDT requirement & extra occupation from the change cell
      expect(resultTx.inputs.length).toBe(3); // 1 non-UDT + 2 UDT

      // Verify UDT balance is satisfied
      const inputBalance = await udt.getInputsBalance(client, resultTx);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });
  });

  describe("infoFrom", () => {
    let validUdtCell1: ccc.CellAny;
    let validUdtCell2: ccc.CellAny;
    let nonUdtCell: ccc.CellAny;
    let otherUdtCell: ccc.CellAny;

    beforeEach(async () => {
      validUdtCell1 = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(142),
          lock,
          type,
        },
        outputData: ccc.numLeToBytes(100, 16), // 100 UDT
      });

      validUdtCell2 = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(200),
          lock,
          type,
        },
        outputData: ccc.numLeToBytes(250, 16), // 250 UDT
      });

      nonUdtCell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(500),
          lock,
        },
        outputData: "0x",
      });

      const otherUdtScript = await ccc.Script.fromKnownScript(
        client,
        ccc.KnownScript.XUdt,
        "0x" + "1".repeat(64),
      );
      otherUdtCell = ccc.CellAny.from({
        cellOutput: {
          capacity: ccc.fixedPointFrom(142),
          lock,
          type: otherUdtScript,
        },
        outputData: ccc.numLeToBytes(1000, 16), // 1000 other UDT
      });
    });

    it("should return zero for an empty list of cells", async () => {
      const info = await udt.infoFrom(client, []);
      expect(info.balance).toBe(ccc.Zero);
      expect(info.capacity).toBe(ccc.Zero);
      expect(info.count).toBe(0);
    });

    it("should correctly calculate info for a list of valid UDT cells", async () => {
      const info = await udt.infoFrom(client, [validUdtCell1, validUdtCell2]);
      expect(info.balance).toBe(ccc.numFrom(350)); // 100 + 250
      expect(info.capacity).toBe(ccc.fixedPointFrom(342)); // 142 + 200
      expect(info.count).toBe(2);
    });

    it("should ignore non-UDT cells and cells of other UDTs", async () => {
      const info = await udt.infoFrom(client, [
        validUdtCell1,
        nonUdtCell,
        otherUdtCell,
      ]);
      expect(info.balance).toBe(ccc.numFrom(100));
      expect(info.capacity).toBe(ccc.fixedPointFrom(142));
      expect(info.count).toBe(1);
    });
  });

  describe("calculateInfo", () => {
    let mockUdtCells: ccc.Cell[];

    beforeEach(() => {
      mockUdtCells = [
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "a".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(142), lock, type },
          outputData: ccc.numLeToBytes(100, 16), // 100 UDT
        }),
        ccc.Cell.from({
          outPoint: { txHash: "0x" + "b".repeat(64), index: 0 },
          cellOutput: { capacity: ccc.fixedPointFrom(200), lock, type },
          outputData: ccc.numLeToBytes(250, 16), // 250 UDT
        }),
      ];
    });

    it("should calculate info from local source", async () => {
      const findCellsSpy = vi
        .spyOn(signer, "findCells")
        .mockImplementation(async function* () {
          for (const cell of mockUdtCells) {
            yield cell;
          }
        });

      const info = await udt.calculateInfo(signer, { source: "local" });

      expect(info.balance).toBe(ccc.numFrom(350));
      expect(info.capacity).toBe(ccc.fixedPointFrom(342));
      expect(info.count).toBe(2);
      expect(findCellsSpy).toHaveBeenCalledWith(udt.filter);
    });

    it("should calculate info from chain source", async () => {
      const findCellsOnChainSpy = vi
        .spyOn(signer, "findCellsOnChain")
        .mockImplementation(async function* () {
          for (const cell of mockUdtCells) {
            yield cell;
          }
        });

      const info = await udt.calculateInfo(signer, { source: "chain" });

      expect(info.balance).toBe(ccc.numFrom(350));
      expect(info.capacity).toBe(ccc.fixedPointFrom(342));
      expect(info.count).toBe(2);
      expect(findCellsOnChainSpy).toHaveBeenCalledWith(udt.filter);
    });
  });
});
