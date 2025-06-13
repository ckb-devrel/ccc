/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ccc } from "../index.js";

let client: ccc.Client;
let signer: ccc.Signer;
let lock: ccc.Script;

let type: ccc.Script;

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
});

describe("Transaction", () => {
  describe("completeInputsByUdt", () => {
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

      const addedCount = await tx.completeInputsByUdt(signer, type);
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

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should add 2 cells (200 UDT total) to have at least 2 inputs
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      // Verify the inputs are UDT cells
      const inputBalance = await tx.getInputsUdtBalance(client, type);
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

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should add only 1 cell since it matches exactly
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
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
      const addedCount = await tx.completeInputsByUdt(signer, type, 50);

      // Should add 2 cells to cover 150 UDT total requirement
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
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

      const addedCount = await tx.completeInputsByUdt(signer, type);

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

      await expect(tx.completeInputsByUdt(signer, type)).rejects.toThrow(
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

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should add 3 cells to cover 250 UDT requirement (300 UDT total)
      expect(addedCount).toBe(3);
      expect(tx.inputs.length).toBe(3);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
      expect(inputBalance).toBe(ccc.numFrom(300));

      const outputBalance = tx.getOutputsUdtBalance(type);
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

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should add 1 more cell (since we already have 1 input with 100 UDT)
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });

    it("should add two cells when user has multiple cells but only needs one to avoid change fees", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need only 50 UDT (less than one cell)
      });

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should add 2 cells even though 1 cell (100 UDT) would be enough
      // This avoids the need for a change cell
      expect(addedCount).toBe(2);
      expect(tx.inputs.length).toBe(2);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
      expect(inputBalance).toBe(ccc.numFrom(200));
    });

    it("should use only one cell when user has only one cell available", async () => {
      // Mock signer to return only one cell
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          if (filter.script && ccc.Script.from(filter.script).eq(type)) {
            yield mockUdtCells[0]; // Only yield the first cell
          }
        },
      );

      const tx = ccc.Transaction.from({
        outputs: [
          {
            lock,
            type,
          },
        ],
        outputsData: [ccc.numLeToBytes(50, 16)], // Need only 50 UDT
      });

      const addedCount = await tx.completeInputsByUdt(signer, type);

      // Should use only 1 cell since that's all that's available
      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(1);

      const inputBalance = await tx.getInputsUdtBalance(client, type);
      expect(inputBalance).toBe(ccc.numFrom(100));
    });
  });

  describe("completeFee", () => {
    // Mock cells for capacity completion (100 CKB each)
    let mockCapacityCells: ccc.Cell[];
    const cellCapacity = ccc.fixedPointFrom(100); // 100 CKB per cell
    const minChangeCapacity = ccc.fixedPointFrom(61); // Minimum capacity for a change cell

    beforeEach(async () => {
      // Create mock cells for capacity completion
      mockCapacityCells = Array.from({ length: 10 }, (_, i) =>
        ccc.Cell.from({
          outPoint: {
            txHash: `0x${"1".repeat(63)}${i.toString(16)}`,
            index: 0,
          },
          cellOutput: {
            capacity: cellCapacity,
            lock,
          },
          outputData: "0x",
        }),
      );
    });

    beforeEach(() => {
      // Mock the findCells method to return capacity cells
      vi.spyOn(signer, "findCells").mockImplementation(
        async function* (filter) {
          // Return capacity cells for general queries
          if (!filter.script || filter.scriptLenRange) {
            for (const cell of mockCapacityCells) {
              yield cell;
            }
          }
        },
      );

      // Mock client.getCell to return the cell data for inputs
      vi.spyOn(client, "getCell").mockImplementation(async (outPoint) => {
        const cell = mockCapacityCells.find((c) => c.outPoint.eq(outPoint));
        return cell;
      });

      // Mock client.getFeeRate to return a predictable fee rate
      vi.spyOn(client, "getFeeRate").mockResolvedValue(ccc.numFrom(1000)); // 1000 shannons per 1000 bytes

      // Mock signer.prepareTransaction to return the transaction as-is
      vi.spyOn(signer, "prepareTransaction").mockImplementation(async (tx) =>
        ccc.Transaction.from(tx),
      );

      // Mock signer.getRecommendedAddressObj
      vi.spyOn(signer, "getRecommendedAddressObj").mockResolvedValue({
        script: lock,
        prefix: "ckt",
      });
    });

    it("should complete fee without change when exact fee is available", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(99.9), // Leave small amount for fee
            lock,
          },
        ],
      });

      const [addedInputs, hasChange] = await tx.completeFee(
        signer,
        (tx, capacity) => {
          // Always use all available capacity by adding to first output
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        1000n, // 1000 shannons per 1000 bytes
      );

      expect(addedInputs).toBe(0); // No additional inputs needed
      expect(hasChange).toBe(true); // Change was applied (capacity added to existing output)
      expect(tx.outputs.length).toBe(1); // Original output only (no new outputs)
    });

    it("should complete fee with change when excess capacity is available", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(30), // Leave 70 CKB excess
            lock,
          },
        ],
      });

      const [addedInputs, hasChange] = await tx.completeFee(
        signer,
        (tx, capacity) => {
          // Create change if capacity is sufficient
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        1000n,
      );

      expect(addedInputs).toBe(0); // No additional inputs needed
      expect(hasChange).toBe(true); // Change created
      expect(tx.outputs.length).toBe(2); // Original output + change
      expect(tx.outputs[1].capacity).toBeGreaterThan(minChangeCapacity);
    });

    it("should add inputs when insufficient capacity for fee", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(50), // Need inputs to cover this
            lock,
          },
        ],
      });

      const [addedInputs, _hasChange] = await tx.completeFee(
        signer,
        (tx, capacity) => {
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        1000n,
      );

      expect(addedInputs).toBeGreaterThan(0); // Inputs were added
      expect(tx.inputs.length).toBe(addedInputs);
      expect(tx.outputs.length).toBe(2); // Original output + change
    });

    it("should handle change function requesting more capacity", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(30), // Leave 70 CKB excess
            lock,
          },
        ],
      });

      let callCount = 0;
      const [addedInputs, hasChange] = await tx.completeFee(
        signer,
        (tx, capacity) => {
          callCount++;
          // First call: request more capacity than available (but reasonable)
          if (callCount === 1) {
            return ccc.fixedPointFrom(80); // Request 80 CKB but only ~70 available
          }
          // Second call: after more inputs added, use all available capacity
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        1000n,
      );

      expect(addedInputs).toBeGreaterThan(0); // Additional inputs added
      expect(hasChange).toBe(true); // Change eventually created
    });

    it("should use provided fee rate instead of fetching from client", async () => {
      const customFeeRate = 2000n; // 2000 shannons per 1000 bytes
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(99),
            lock,
          },
        ],
      });

      await tx.completeFee(
        signer,
        (tx, capacity) => {
          // Use all available capacity
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        customFeeRate,
      );

      // Verify that client.getFeeRate was not called since we provided the rate
      expect(client.getFeeRate).not.toHaveBeenCalled();
    });

    it("should respect shouldAddInputs option when set to false", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(50), // Would normally need inputs
            lock,
          },
        ],
      });

      await expect(
        tx.completeFee(signer, (_tx, _capacity) => 0, 1000n, undefined, {
          shouldAddInputs: false,
        }),
      ).rejects.toThrow("Insufficient CKB");
    });

    it("should handle filter parameter for input selection", async () => {
      const customFilter = {
        scriptLenRange: [0, 1] as [number, number],
        outputDataLenRange: [0, 10] as [number, number],
      };

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(50),
            lock,
          },
        ],
      });

      await tx.completeFee(
        signer,
        (tx, capacity) => {
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        1000n,
        customFilter,
      );

      // Verify that findCells was called with the custom filter
      expect(signer.findCells).toHaveBeenCalledWith(customFilter, true);
    });

    it("should throw error when change function doesn't use all capacity", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(30),
            lock,
          },
        ],
      });

      await expect(
        tx.completeFee(
          signer,
          (_tx, _capacity) => {
            // Don't use the capacity but return 0 (claiming it's handled)
            return 0;
          },
          1000n,
        ),
      ).rejects.toThrow("doesn't use all available capacity");
    });

    it("should handle fee rate from client when not provided", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(99),
            lock,
          },
        ],
      });

      await tx.completeFee(signer, (tx, capacity) => {
        // Use all available capacity
        tx.outputs[0].capacity += capacity;
        return 0;
      });

      // Verify that client.getFeeRate was called
      expect(client.getFeeRate).toHaveBeenCalledWith(undefined, undefined);
    });

    it("should pass feeRateBlockRange option to client.getFeeRate", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
        outputs: [
          {
            capacity: ccc.fixedPointFrom(99),
            lock,
          },
        ],
      });

      const options = {
        feeRateBlockRange: 10n,
        maxFeeRate: 5000n,
      };

      await tx.completeFee(
        signer,
        (tx, capacity) => {
          // Use all available capacity
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        undefined,
        undefined,
        options,
      );

      expect(client.getFeeRate).toHaveBeenCalledWith(
        options.feeRateBlockRange,
        options,
      );
    });
  });
});
