/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ccc } from "../index.js";
import { FeePayerFromAddress } from "./feePayerFromAddress.js";

class MockFeePayer extends FeePayerFromAddress {
  constructor(
    client: ccc.Client,
    private readonly lock: ccc.Script,
  ) {
    super(client);
  }

  async getAddressObjs(): Promise<ccc.Address[]> {
    return [
      ccc.Address.from({
        prefix: this.client.addressPrefix,
        script: this.lock,
      }),
    ];
  }
}

describe("FeePayer", () => {
  let client: ccc.Client;
  let feePayer: MockFeePayer;
  let lock: ccc.Script;

  // Mock cells for capacity completion (200 CKB each)
  let mockCapacityCells: ccc.Cell[];
  const cellCapacity = ccc.fixedPointFrom(200); // 200 CKB per cell
  const minChangeCapacity = ccc.fixedPointFrom(61); // Minimum capacity for a change cell

  beforeEach(async () => {
    client = new ccc.ClientPublicTestnet();
    lock = ccc.Script.from({
      codeHash: `0x${"0".repeat(64)}`,
      hashType: "type",
      args: "0x",
    });
    feePayer = new MockFeePayer(client, lock);

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

    // Mock the findCells method to return capacity cells only for the main lock
    vi.spyOn(client, "findCells").mockImplementation(
      async function* (searchKey) {
        if (ccc.Script.from(searchKey.script).eq(lock)) {
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
  });

  describe("completeInputs", () => {
    it("should collect cells using the accumulator", async () => {
      const tx = ccc.Transaction.from({
        outputs: [],
      });

      // Collect 3 cells
      const { addedCount, accumulated } = await feePayer.completeInputs(
        tx,
        (acc, _cell, _i, collected) => {
          return collected.length >= 3 ? undefined : acc + 1;
        },
        0,
      );

      expect(addedCount).toBe(3);
      expect(tx.inputs.length).toBe(3);
      expect(accumulated).toBeUndefined();
    });

    it("should skip cells already in inputs", async () => {
      const tx = ccc.Transaction.from({
        inputs: [
          {
            previousOutput: mockCapacityCells[0].outPoint,
          },
        ],
      });

      const { addedCount } = await feePayer.completeInputs(
        tx,
        (_acc, cell, _i, _collected) => {
          // Should not see mockCapacityCells[0] here
          expect(cell.outPoint.eq(mockCapacityCells[0].outPoint)).toBe(false);
          return undefined; // Stop after one
        },
        0,
      );

      expect(addedCount).toBe(1);
      expect(tx.inputs.length).toBe(2);
      expect(
        tx.inputs[1].previousOutput.eq(mockCapacityCells[1].outPoint),
      ).toBe(true);
    });

    describe("completeInputsByCapacity", () => {
      it("should collect enough capacity", async () => {
        const tx = ccc.Transaction.from({
          outputs: [
            {
              capacity: ccc.fixedPointFrom(250),
              lock,
            },
          ],
        });

        const { addedCount } = await feePayer.completeInputsByCapacity(tx);

        // Each cell has 200 CKB, so need 2 cells for 250 CKB
        expect(addedCount).toBe(2);
        expect(tx.inputs.length).toBe(2);
      });

      it("should return 0 if already have enough capacity", async () => {
        const tx = ccc.Transaction.from({
          inputs: [
            {
              previousOutput: mockCapacityCells[0].outPoint,
            },
            {
              previousOutput: mockCapacityCells[1].outPoint,
            },
            {
              previousOutput: mockCapacityCells[2].outPoint,
            },
          ],
          outputs: [
            {
              capacity: ccc.fixedPointFrom(250),
              lock,
            },
          ],
        });

        const { addedCount } = await feePayer.completeInputsByCapacity(tx);

        expect(addedCount).toBe(0);
        expect(tx.inputs.length).toBe(3);
      });

      it("should handle capacityTweak", async () => {
        const tx = ccc.Transaction.from({
          outputs: [
            {
              capacity: ccc.fixedPointFrom(150),
              lock,
            },
          ],
        });

        // Need 150 + 200 = 350 CKB -> 2 cells
        const { addedCount } = await feePayer.completeInputsByCapacity(
          tx,
          ccc.fixedPointFrom(100),
        );

        expect(addedCount).toBe(2);
      });

      it("should throw error if insufficient capacity", async () => {
        const tx = ccc.Transaction.from({
          outputs: [
            {
              capacity: ccc.fixedPointFrom(3000), // More than 10 * 200 available
              lock,
            },
          ],
        });

        await expect(feePayer.completeInputsByCapacity(tx)).rejects.toThrow(
          "Insufficient CKB",
        );
      });
    });

    describe("completeInputsAll", () => {
      it("should collect all cells", async () => {
        const tx = ccc.Transaction.from({
          outputs: [],
        });

        const { addedCount } = await feePayer.completeInputsAll(tx);

        expect(addedCount).toBe(mockCapacityCells.length);
        expect(tx.inputs.length).toBe(mockCapacityCells.length);
      });
    });

    describe("completeInputsAddOne", () => {
      it("should add exactly one cell", async () => {
        const tx = ccc.Transaction.from({
          outputs: [],
        });

        const { addedCount } = await feePayer.completeInputsAddOne(tx);

        expect(addedCount).toBe(1);
        expect(tx.inputs.length).toBe(1);
      });

      it("should throw if no cells available", async () => {
        // Mock no cells available
        vi.spyOn(client, "findCells").mockImplementation(async function* () {});

        const tx = ccc.Transaction.from({
          outputs: [],
        });

        await expect(feePayer.completeInputsAddOne(tx)).rejects.toThrow(
          "at least one new cell",
        );
      });
    });

    describe("completeInputsAtLeastOne", () => {
      it("should add one cell if empty", async () => {
        const tx = ccc.Transaction.from({
          outputs: [],
        });

        const { addedCount } = await feePayer.completeInputsAtLeastOne(tx);

        expect(addedCount).toBe(1);
        expect(tx.inputs.length).toBe(1);
      });

      it("should add nothing if not empty", async () => {
        const tx = ccc.Transaction.from({
          inputs: [
            {
              previousOutput: mockCapacityCells[0].outPoint,
            },
          ],
        });

        const { addedCount } = await feePayer.completeInputsAtLeastOne(tx);

        expect(addedCount).toBe(0);
        expect(tx.inputs.length).toBe(1);
      });
    });
  });

  describe("completeFee", () => {
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

      const {
        tx: resTx,
        hasChanged,
        context: { addedCount },
      } = await feePayer.completeFeeChangeTo(
        tx,
        (tx, capacity) => {
          // Always use all available capacity by adding to first output
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        { feeRate: 1000n },
      );

      expect(addedCount).toBe(0); // No additional inputs needed
      expect(hasChanged).toBe(true); // Change was applied (capacity added to existing output)
      expect(resTx.outputs.length).toBe(1); // Original output only (no new outputs)
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

      const {
        tx: resTx,
        hasChanged,
        context: { addedCount },
      } = await feePayer.completeFeeChangeTo(
        tx,
        (tx, capacity) => {
          // Create change if capacity is sufficient
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        { feeRate: 1000n },
      );

      expect(addedCount).toBe(0); // No additional inputs needed
      expect(hasChanged).toBe(true); // Change created
      expect(resTx.outputs.length).toBe(2); // Original output + change
      expect(resTx.outputs[1].capacity).toBeGreaterThan(minChangeCapacity);
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

      const {
        tx: resTx,
        context: { addedCount },
      } = await feePayer.completeFeeChangeTo(
        tx,
        (tx, capacity) => {
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        { feeRate: 1000n },
      );

      expect(addedCount).toBeGreaterThan(0); // Inputs were added
      expect(resTx.inputs.length).toBe(addedCount);
      expect(resTx.outputs.length).toBe(2); // Original output + change
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
            capacity: ccc.fixedPointFrom(130), // Leave 70 CKB excess
            lock,
          },
        ],
      });

      let callCount = 0;
      const {
        hasChanged,
        context: { addedCount },
      } = await feePayer.completeFeeChangeTo(
        tx,
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
        { feeRate: 1000n },
      );

      expect(addedCount).toBeGreaterThan(0); // Additional inputs added
      expect(hasChanged).toBe(true); // Change eventually created
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

      await feePayer.completeFeeChangeTo(
        tx,
        (tx, capacity) => {
          // Use all available capacity
          tx.outputs[0].capacity += capacity;
          return 0;
        },
        { feeRate: customFeeRate },
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
        feePayer.completeFeeChangeTo(tx, (_tx, _capacity) => 0, {
          feeRate: 1000n,
          shouldAddInputs: false,
        }),
      ).rejects.toThrow("Insufficient CKB");
    });

    it("should handle filter parameter for input selection", async () => {
      const customFilter = {
        scriptLenRange: [0n, 1n] as [ccc.NumLike, ccc.NumLike],
        outputDataLenRange: [0n, 10n] as [ccc.NumLike, ccc.NumLike],
      };

      const tx = ccc.Transaction.from({
        outputs: [
          {
            capacity: ccc.fixedPointFrom(50),
            lock,
          },
        ],
      });

      await feePayer.completeFeeChangeTo(
        tx,
        (tx, capacity) => {
          if (capacity >= minChangeCapacity) {
            tx.addOutput({ capacity, lock });
            return 0;
          }
          return minChangeCapacity;
        },
        {
          feeRate: 1000n,
          filter: customFilter,
        },
      );

      // Verify that findCells was called with the custom filter
      expect(client.findCells).toHaveBeenCalledWith(
        expect.objectContaining({
          script: lock,
          scriptType: "lock",
          filter: expect.objectContaining({
            scriptLenRange: customFilter.scriptLenRange,
            outputDataLenRange: customFilter.outputDataLenRange,
          }) as ccc.ClientCollectableSearchKeyFilterLike,
          scriptSearchMode: "exact",
          withData: true,
        }),
      );
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
        feePayer.completeFeeChangeTo(
          tx,
          (_tx, _capacity) => {
            // Don't use the capacity but return 0 (claiming it's handled)
            return 0;
          },
          { feeRate: 1000n },
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

      await feePayer.completeFee(tx);

      // Verify that client.getFeeRate was called
      expect(client.getFeeRate).toHaveBeenCalledOnce();
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

      await feePayer.completeFee(tx, options);

      expect(client.getFeeRate).toHaveBeenCalledWith(
        options.feeRateBlockRange,
        expect.objectContaining({
          feeRateBlockRange: options.feeRateBlockRange,
          maxFeeRate: options.maxFeeRate,
        }),
      );
    });
  });
});
