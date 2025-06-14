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

  describe("Automatic Capacity Completion", () => {
    describe("CellOutput.from", () => {
      it("should use explicit capacity when provided", () => {
        const cellOutput = ccc.CellOutput.from({
          capacity: 1000n,
          lock,
        });

        expect(cellOutput.capacity).toBe(1000n);
      });

      it("should calculate capacity automatically when capacity is 0", () => {
        const outputData = "0x1234"; // 2 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            capacity: 0n,
            lock,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize + 2; // occupiedSize + outputData length
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should calculate capacity automatically when capacity is omitted", () => {
        const outputData = "0x5678"; // 2 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize + 2; // occupiedSize + outputData length
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should handle empty outputData in automatic calculation", () => {
        const outputData = "0x"; // 0 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize; // occupiedSize + 0
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should handle long outputData in automatic calculation", () => {
        const outputData = "0x" + "12".repeat(100); // 100 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize + 100; // occupiedSize + outputData length
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should calculate capacity with type script", () => {
        const outputData = "0x1234"; // 2 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
            type,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize + 2; // occupiedSize (including type) + outputData length
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should not auto-calculate when capacity is explicitly provided even with outputData", () => {
        const outputData = "0x1234"; // 2 bytes
        const explicitCapacity = 5000n;
        const cellOutput = ccc.CellOutput.from(
          {
            capacity: explicitCapacity,
            lock,
          },
          outputData,
        );

        expect(cellOutput.capacity).toBe(explicitCapacity);
      });

      it("should handle the overloaded signature correctly", () => {
        // Test the overloaded signature where capacity is omitted and outputData is required
        const outputData = "0xabcd";
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
            type,
          },
          outputData,
        );

        const expectedCapacity = cellOutput.occupiedSize + 2;
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });
    });

    describe("Transaction.from", () => {
      it("should create transaction with automatic capacity calculation for outputs", () => {
        const outputsData = ["0x1234", "0x567890"];
        const tx = ccc.Transaction.from({
          outputs: [
            {
              lock,
            },
            {
              lock,
              type,
            },
          ],
          outputsData,
        });

        // First output: lock only + 2 bytes data
        const expectedCapacity1 = 8 + lock.occupiedSize + 2; // capacity field + lock + outputData
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity1),
        );

        // Second output: lock + type + 3 bytes data
        const expectedCapacity2 = 8 + lock.occupiedSize + type.occupiedSize + 3; // capacity field + lock + type + outputData
        expect(tx.outputs[1].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity2),
        );

        expect(tx.outputsData).toEqual([
          ccc.hexFrom("0x1234"),
          ccc.hexFrom("0x567890"),
        ]);
      });

      it("should handle mixed explicit and automatic capacity calculation", () => {
        const outputsData = ["0x12", "0x3456"];
        const explicitCapacity = 5000n;
        const tx = ccc.Transaction.from({
          outputs: [
            {
              capacity: explicitCapacity,
              lock,
            },
            {
              lock,
            },
          ],
          outputsData,
        });

        // First output: explicit capacity
        expect(tx.outputs[0].capacity).toBe(explicitCapacity);

        // Second output: automatic calculation
        const expectedCapacity2 = 8 + lock.occupiedSize + 2;
        expect(tx.outputs[1].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity2),
        );
      });

      it("should handle empty outputsData array", () => {
        const tx = ccc.Transaction.from({
          outputs: [
            {
              lock,
            },
          ],
          outputsData: [],
        });

        // Should use empty data for calculation
        const expectedCapacity = 8 + lock.occupiedSize + 0;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );
        expect(tx.outputsData).toEqual([ccc.hexFrom("0x")]);
      });

      it("should handle missing outputsData", () => {
        const tx = ccc.Transaction.from({
          outputs: [
            {
              lock,
            },
          ],
        });

        // Should use empty data for calculation
        const expectedCapacity = 8 + lock.occupiedSize + 0;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );
        expect(tx.outputsData).toEqual([ccc.hexFrom("0x")]);
      });

      it("should handle more outputsData than outputs", () => {
        const outputsData = ["0x12", "0x34", "0x56"];
        const tx = ccc.Transaction.from({
          outputs: [
            {
              lock,
            },
          ],
          outputsData,
        });

        // First output should use first outputData
        const expectedCapacity = 8 + lock.occupiedSize + 1;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );

        // All outputsData should be preserved
        expect(tx.outputsData).toEqual([
          ccc.hexFrom("0x12"),
          ccc.hexFrom("0x34"),
          ccc.hexFrom("0x56"),
        ]);
      });
    });

    describe("Transaction.addOutput", () => {
      it("should add output with automatic capacity calculation", () => {
        const tx = ccc.Transaction.default();
        const outputData = "0x1234";

        const outputCount = tx.addOutput(
          {
            lock,
          },
          outputData,
        );

        expect(outputCount).toBe(1);
        expect(tx.outputs.length).toBe(1);

        const expectedCapacity = 8 + lock.occupiedSize + 2;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );
        expect(tx.outputsData[0]).toBe(ccc.hexFrom(outputData));
      });

      it("should add output with type script and automatic capacity calculation", () => {
        const tx = ccc.Transaction.default();
        const outputData = "0x567890";

        tx.addOutput(
          {
            lock,
            type,
          },
          outputData,
        );

        const expectedCapacity = 8 + lock.occupiedSize + type.occupiedSize + 3;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );
        expect(tx.outputsData[0]).toBe(ccc.hexFrom(outputData));
      });

      it("should add output with explicit capacity", () => {
        const tx = ccc.Transaction.default();
        const outputData = "0x12";
        const explicitCapacity = 10000n;

        tx.addOutput(
          {
            capacity: explicitCapacity,
            lock,
          },
          outputData,
        );

        expect(tx.outputs[0].capacity).toBe(explicitCapacity);
        expect(tx.outputsData[0]).toBe(ccc.hexFrom(outputData));
      });

      it("should add output with default empty outputData", () => {
        const tx = ccc.Transaction.default();

        tx.addOutput({
          lock,
        });

        const expectedCapacity = 8 + lock.occupiedSize + 0;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
        );
        expect(tx.outputsData[0]).toBe(ccc.hexFrom("0x"));
      });

      it("should add multiple outputs with automatic capacity calculation", () => {
        const tx = ccc.Transaction.default();

        tx.addOutput({ lock }, "0x12");
        tx.addOutput({ lock, type }, "0x3456");

        expect(tx.outputs.length).toBe(2);

        // First output
        const expectedCapacity1 = 8 + lock.occupiedSize + 1;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity1),
        );

        // Second output
        const expectedCapacity2 = 8 + lock.occupiedSize + type.occupiedSize + 2;
        expect(tx.outputs[1].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity2),
        );

        expect(tx.outputsData).toEqual([
          ccc.hexFrom("0x12"),
          ccc.hexFrom("0x3456"),
        ]);
      });
    });

    describe("Edge Cases and Error Handling", () => {
      it("should handle CellOutput instance passed to CellOutput.from", () => {
        const originalOutput = ccc.CellOutput.from({
          capacity: 1000n,
          lock,
        });

        const result = ccc.CellOutput.from(originalOutput);
        expect(result).toBe(originalOutput); // Should return the same instance
      });

      it("should handle Cell instance passed to Cell.from", () => {
        const originalCell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "0".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: 1000n,
            lock,
          },
          outputData: "0x",
        });

        const result = ccc.Cell.from(originalCell);
        expect(result).toBe(originalCell); // Should return the same instance
      });

      it("should handle Transaction instance passed to Transaction.from", () => {
        const originalTx = ccc.Transaction.from({
          outputs: [{ capacity: 1000n, lock }],
          outputsData: ["0x"],
        });

        const result = ccc.Transaction.from(originalTx);
        expect(result).toBe(originalTx); // Should return the same instance
      });

      it("should calculate minimum capacity correctly", () => {
        // Test with minimal lock script
        const minimalLock = ccc.Script.from({
          codeHash: "0x" + "0".repeat(64),
          hashType: "data",
          args: "0x",
        });

        const cellOutput = ccc.CellOutput.from(
          {
            lock: minimalLock,
          },
          "0x",
        );

        // Minimum capacity should be 8 (capacity field) + lock.occupiedSize + 0 (empty data)
        const expectedMinCapacity = 8 + minimalLock.occupiedSize;
        expect(cellOutput.capacity).toBe(
          ccc.fixedPointFrom(expectedMinCapacity),
        );
      });

      it("should handle very large outputData", () => {
        // Create 1KB of data
        const largeData = "0x" + "ff".repeat(1024);
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
          },
          largeData,
        );

        const expectedCapacity = 8 + lock.occupiedSize + 1024;
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should handle null type script correctly", () => {
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
            type: null,
          },
          "0x1234",
        );

        // Should not include type script in calculation
        const expectedCapacity = 8 + lock.occupiedSize + 2;
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
        expect(cellOutput.type).toBeUndefined();
      });

      it("should handle empty outputData in overloaded signature", () => {
        // This tests the overloaded signature where outputData is required
        const cellOutput = ccc.CellOutput.from(
          {
            lock,
          },
          "0x", // Empty data
        );

        // Should treat empty outputData as 0 bytes
        const expectedCapacity = 8 + lock.occupiedSize + 0;
        expect(cellOutput.capacity).toBe(ccc.fixedPointFrom(expectedCapacity));
      });

      it("should verify occupiedSize calculation includes all components", () => {
        const cellOutput = ccc.CellOutput.from({
          capacity: 1000n,
          lock,
          type,
        });

        // occupiedSize should include capacity field (8 bytes) + lock + type
        const expectedOccupiedSize = 8 + lock.occupiedSize + type.occupiedSize;
        expect(cellOutput.occupiedSize).toBe(expectedOccupiedSize);
      });

      it("should verify Cell occupiedSize includes outputData", () => {
        const outputData = "0x123456";
        const cell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "0".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: 1000n,
            lock,
          },
          outputData,
        });

        // Cell occupiedSize should include CellOutput occupiedSize + outputData length
        const expectedOccupiedSize = cell.cellOutput.occupiedSize + 3; // 3 bytes of data
        expect(cell.occupiedSize).toBe(expectedOccupiedSize);
      });

      it("should calculate capacityFree correctly", () => {
        const outputData = "0x1234";
        const explicitCapacity = 1000n;
        const cell = ccc.Cell.from({
          outPoint: {
            txHash: "0x" + "0".repeat(64),
            index: 0,
          },
          cellOutput: {
            capacity: explicitCapacity,
            lock,
          },
          outputData,
        });

        const expectedFreeCapacity =
          explicitCapacity - ccc.fixedPointFrom(cell.occupiedSize);
        expect(cell.capacityFree).toBe(expectedFreeCapacity);
      });
    });
  });
});
