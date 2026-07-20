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
  describe("indexed setters", () => {
    const input = (suffix: string, index = 0): ccc.CellInputLike => ({
      previousOutput: {
        txHash: `0x${"0".repeat(64 - suffix.length)}${suffix}`,
        index,
      },
    });

    it("sets output data and fills skipped positions with empty data", () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }, { lock }, { lock }],
      });
      tx.outputsData = [];

      tx.setOutputData(2, "0x1234");

      expect(tx.outputsData).toEqual(["0x", "0x", "0x1234"]);
      expect(tx.getOutputData(2)).toBe("0x1234");
    });

    it("replaces an output and its data", () => {
      const tx = ccc.Transaction.from({
        outputs: [{ lock }],
        outputsData: ["0x12"],
      });

      tx.setOutput(0, {
        cellOutput: { lock, type },
        outputData: "0x3456",
      });

      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputs[0].type?.eq(type)).toBe(true);
      expect(tx.outputsData).toEqual(["0x3456"]);
    });

    it("appends an output when index equals the output count", () => {
      const tx = ccc.Transaction.default();

      tx.setOutput(0, { lock }, "0xab");

      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputsData).toEqual(["0xab"]);
    });

    it("replaces an input without changing witnesses", () => {
      const tx = ccc.Transaction.from({
        inputs: [input("1")],
        witnesses: ["0xaa"],
      });

      tx.setInput(0, input("2", 1));

      expect(tx.inputs).toHaveLength(1);
      expect(tx.inputs[0].previousOutput.txHash).toBe(`0x${"0".repeat(63)}2`);
      expect(tx.inputs[0].previousOutput.index).toBe(1n);
      expect(tx.witnesses).toEqual(["0xaa"]);
    });

    it("appends an input while preserving witness alignment", () => {
      const tx = ccc.Transaction.from({
        inputs: [input("1")],
        witnesses: ["0xaa", "0xbb"],
      });

      tx.setInput(1, input("2"));

      expect(tx.inputs).toHaveLength(2);
      expect(tx.witnesses).toEqual(["0xaa", "0x", "0xbb"]);
    });

    it("sets and gets witness args without At suffixes", () => {
      const tx = ccc.Transaction.default();

      tx.setWitnessArgs(1, { lock: "0x1234" });

      expect(tx.getWitness(0)).toBe("0x");
      expect(tx.getWitness(1)).not.toBe("0x");
      expect(tx.getWitnessArgs(1)?.lock).toBe("0x1234");
      expect(tx.getWitnessArgsUnsafe(1)?.lock).toBe("0x1234");
    });

    it.each([-1, 0.5, NaN, 2 ** 32 - 1, Number.MAX_SAFE_INTEGER + 1])(
      "returns undefined from getters for invalid index %s",
      (index) => {
        const tx = ccc.Transaction.default();

        expect(tx.getInput(index)).toBeUndefined();
        expect(tx.getOutput(index)).toBeUndefined();
        expect(tx.getOutputData(index)).toBeUndefined();
        expect(tx.getWitness(index)).toBeUndefined();
        expect(tx.getWitnessArgs(index)).toBeUndefined();
        expect(tx.getWitnessArgsUnsafe(index)).toBeUndefined();
      },
    );

    it.each([
      ["setOutput", (tx: ccc.Transaction) => tx.setOutput(1, { lock })],
      ["setOutput", (tx: ccc.Transaction) => tx.setOutput(0.5, { lock })],
      ["setInput", (tx: ccc.Transaction) => tx.setInput(1, input("1"))],
      ["setInput", (tx: ccc.Transaction) => tx.setInput(NaN, input("1"))],
      ["setOutputData", (tx: ccc.Transaction) => tx.setOutputData(-1, "0x")],
      ["setOutputData", (tx: ccc.Transaction) => tx.setOutputData(0, "0x")],
      ["setWitness", (tx: ccc.Transaction) => tx.setWitness(-1, "0x")],
    ])("rejects invalid indices in %s", (_name, setValue) => {
      expect(() => setValue(ccc.Transaction.default())).toThrow(/Index/);
    });

    it("rejects indices above the maximum array index", () => {
      const tx = ccc.Transaction.default();
      tx.witnesses.length = 2 ** 32 - 1;

      expect(() => tx.setWitness(2 ** 32 - 1, "0x")).toThrow(
        "must be a valid array index between 0 and 4294967294",
      );
    });
  });

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

      // Mock the findCells method to return our mock UDT cells
      vi.spyOn(client, "findCells").mockImplementation(
        async function* (searchKey) {
          if (
            searchKey.filter?.script &&
            ccc.Script.from(searchKey.filter.script).eq(type)
          ) {
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
      vi.spyOn(client, "findCells").mockImplementation(
        async function* (searchKey) {
          if (
            searchKey.filter?.script &&
            ccc.Script.from(searchKey.filter.script).eq(type)
          ) {
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

      // Mock the findCells method to return capacity cells
      vi.spyOn(client, "findCells").mockImplementation(
        async function* (searchKey) {
          // Return capacity cells for general queries
          if (!searchKey.filter?.script || searchKey.filter?.scriptLenRange) {
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
          {
            previousOutput: mockCapacityCells[1].outPoint,
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
      for (const address of await signer.getAddressObjs()) {
        expect(client.findCells).toHaveBeenCalledWith({
          script: address.script,
          scriptType: "lock",
          filter: customFilter,
          scriptSearchMode: "exact",
          withData: true,
        });
      }
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
      it("should not modify capacity when data is not provided", () => {
        const cellOutput = ccc.CellOutput.from({
          capacity: 100n,
          lock,
        });

        expect(cellOutput.capacity).toBe(100n);
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

      it("should calculate capacity automatically when capacity is less than min requirement", () => {
        const outputData = "0x1234"; // 2 bytes
        const cellOutput = ccc.CellOutput.from(
          {
            capacity: 1000n,
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

      it("should not auto-calculate when capacity is enough even with outputData", () => {
        const outputData = "0x1234"; // 2 bytes
        const explicitCapacity = ccc.fixedPointFrom(100);
        const cellOutput = ccc.CellOutput.from(
          {
            capacity: explicitCapacity,
            lock,
          },
          outputData,
        );

        expect(cellOutput.capacity).toBe(explicitCapacity);
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
        const explicitCapacity = ccc.fixedPointFrom(100);
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

      it("should automatically fill capacity considering outputData while deserialization", () => {
        const outputsData = ["0x1234"];
        const calculatedTx = ccc.Transaction.from({
          outputs: [
            {
              lock,
            },
          ],
          outputsData,
        });
        calculatedTx.outputs[0].capacity = 0n;
        const data = calculatedTx.toBytes();
        expect(ccc.hexFrom(data)).toBe(
          "0xb30000000c000000af000000a30000001c0000002000000024000000280000002c00000095000000000000000000000000000000000000006900000008000000610000001000000018000000610000000000000000000000490000001000000030000000310000009bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8011400000036053c1bbc237e164137c03664fe8384b2cf9b260e0000000800000002000000123404000000",
        );
        const tx = ccc.Transaction.fromBytes(data);

        // Should use outputData for calculation
        const expectedCapacity = 8 + lock.occupiedSize + 2;
        expect(tx.outputs[0].capacity).toBe(
          ccc.fixedPointFrom(expectedCapacity),
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
        const explicitCapacity = ccc.fixedPointFrom(100);

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
        const explicitCapacity = ccc.fixedPointFrom(100);
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

  describe("Fee Payer Layer", () => {
    let mockFeePayer1: ccc.FeePayer;
    let mockFeePayer2: ccc.FeePayer;

    beforeEach(() => {
      // Create mock fee payers
      mockFeePayer1 = {
        prepareTransaction: vi
          .fn()
          .mockImplementation(async (tx: ccc.TransactionLike) =>
            ccc.Transaction.from(tx),
          ),
        completeTxFee: vi.fn().mockResolvedValue(undefined),
      } as unknown as ccc.FeePayer;

      mockFeePayer2 = {
        prepareTransaction: vi
          .fn()
          .mockImplementation(async (tx: ccc.TransactionLike) =>
            ccc.Transaction.from(tx),
          ),
        completeTxFee: vi.fn().mockResolvedValue(undefined),
      } as unknown as ccc.FeePayer;
    });

    it("should call prepareTransaction on all fee payers", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      await tx.completeByFeePayer(mockFeePayer1, mockFeePayer2);

      expect(mockFeePayer1.prepareTransaction).toHaveBeenCalledWith(tx);
      expect(mockFeePayer2.prepareTransaction).toHaveBeenCalledWith(tx);
      expect(mockFeePayer1.prepareTransaction).toHaveBeenCalledTimes(1);
      expect(mockFeePayer2.prepareTransaction).toHaveBeenCalledTimes(1);
    });

    it("should call completeTxFee on all fee payers after prepareTransaction", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      await tx.completeByFeePayer(mockFeePayer1, mockFeePayer2);

      // Verify both methods were called
      expect(mockFeePayer1.prepareTransaction).toHaveBeenCalled();
      expect(mockFeePayer2.prepareTransaction).toHaveBeenCalled();
      expect(mockFeePayer1.completeTxFee).toHaveBeenCalled();
      expect(mockFeePayer2.completeTxFee).toHaveBeenCalled();

      // Verify completeTxFee was called with a Transaction and client
      const completeTxFee1Call = (
        mockFeePayer1.completeTxFee as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      const completeTxFee2Call = (
        mockFeePayer2.completeTxFee as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(completeTxFee1Call[0]).toBeInstanceOf(ccc.Transaction);
      expect(completeTxFee2Call[0]).toBeInstanceOf(ccc.Transaction);

      // Verify prepareTransaction was called before completeTxFee
      // by checking the order of calls
      const prepare1Order = (
        mockFeePayer1.prepareTransaction as ReturnType<typeof vi.fn>
      ).mock.invocationCallOrder[0];
      const complete1Order = (
        mockFeePayer1.completeTxFee as ReturnType<typeof vi.fn>
      ).mock.invocationCallOrder[0];
      expect(prepare1Order).toBeLessThan(complete1Order);
    });

    it("should handle single fee payer", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      await tx.completeByFeePayer(mockFeePayer1);

      expect(mockFeePayer1.prepareTransaction).toHaveBeenCalledTimes(1);
      expect(mockFeePayer1.completeTxFee).toHaveBeenCalledTimes(1);
      expect(mockFeePayer2.prepareTransaction).not.toHaveBeenCalled();
      expect(mockFeePayer2.completeTxFee).not.toHaveBeenCalled();
    });

    it("should handle empty fee payer list", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      // Should not throw with empty fee payer list
      await expect(tx.completeByFeePayer()).resolves.not.toThrow();
    });

    it("should handle multiple fee payers in sequence", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      const callOrder: string[] = [];
      (
        mockFeePayer1.prepareTransaction as ReturnType<typeof vi.fn>
      ).mockImplementation(async (tx: ccc.TransactionLike) => {
        callOrder.push("prepare1");
        return ccc.Transaction.from(tx);
      });
      (
        mockFeePayer2.prepareTransaction as ReturnType<typeof vi.fn>
      ).mockImplementation(async (tx: ccc.TransactionLike) => {
        callOrder.push("prepare2");
        return ccc.Transaction.from(tx);
      });
      (
        mockFeePayer1.completeTxFee as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push("complete1");
      });
      (
        mockFeePayer2.completeTxFee as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push("complete2");
      });

      await tx.completeByFeePayer(mockFeePayer1, mockFeePayer2);

      // Verify order: all prepareTransaction calls first, then all completeTxFee calls
      expect(callOrder).toEqual([
        "prepare1",
        "prepare2",
        "complete1",
        "complete2",
      ]);
    });

    it("should propagate errors from prepareTransaction", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      const error = new Error("Prepare transaction failed");
      (
        mockFeePayer1.prepareTransaction as ReturnType<typeof vi.fn>
      ).mockRejectedValue(error);

      await expect(tx.completeByFeePayer(mockFeePayer1)).rejects.toThrow(
        "Prepare transaction failed",
      );
    });

    it("should propagate errors from completeTxFee", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      const error = new Error("Complete fee failed");
      (
        mockFeePayer1.completeTxFee as ReturnType<typeof vi.fn>
      ).mockRejectedValue(error);

      await expect(tx.completeByFeePayer(mockFeePayer1)).rejects.toThrow(
        "Complete fee failed",
      );
    });

    it("should handle fee payer that modifies transaction in prepareTransaction", async () => {
      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
        ],
      });

      const modifiedTx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(100),
            lock,
          },
          {
            capacity: ccc.fixedPointFrom(50),
            lock,
          },
        ],
      });

      (
        mockFeePayer1.prepareTransaction as ReturnType<typeof vi.fn>
      ).mockResolvedValue(modifiedTx);

      await tx.completeByFeePayer(mockFeePayer1);

      // prepareTransaction is called with a clone of the original transaction
      expect(mockFeePayer1.prepareTransaction).toHaveBeenCalled();
      const prepareCallArg = (
        mockFeePayer1.prepareTransaction as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ccc.Transaction;
      expect(prepareCallArg).toBeInstanceOf(ccc.Transaction);
      expect(prepareCallArg.outputs.length).toBe(1);
      // completeTxFee should be called with the modified transaction returned by prepareTransaction
      expect(mockFeePayer1.completeTxFee).toHaveBeenCalledWith(modifiedTx);
    });
  });
});
