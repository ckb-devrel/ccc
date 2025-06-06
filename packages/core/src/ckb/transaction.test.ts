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
});
