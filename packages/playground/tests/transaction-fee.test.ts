import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it } from "vitest";
import { getSnapshotFee } from "../src/app/components/transactionFee";

const n = BigInt;
describe("snapshot fee rate", () => {
  it("uses serialized bytes plus four and floors like CCC", () => {
    expect(getSnapshotFee(1, n(101), n(100), 299)).toEqual({
      fee: n(1),
      size: 303,
      feeRate: n(3),
    });
  });
  it("does not add DAO extra twice to resolved input capacity", () => {
    expect(getSnapshotFee(1, n(1100), n(1050), 496).feeRate).toBe(n(100));
  });
  it("preserves a known zero fee", () => {
    expect(getSnapshotFee(1, n(100), n(100), 100).feeRate).toBe(n(0));
  });
  it.each([
    [0, n(0), n(0)],
    [1, undefined, n(100)],
    [1, n(99), n(100)],
  ])(
    "does not invent fees for unknown or incomplete inputs",
    (count, input, output) => {
      const result = getSnapshotFee(
        count as number,
        input as bigint | undefined,
        output as bigint,
        100,
      );
      expect(result.fee).toBeUndefined();
      expect(result.feeRate).toBeUndefined();
    },
  );
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER])(
    "rejects invalid serialized size %s",
    (size) => {
      expect(getSnapshotFee(1, n(100), n(90), size).feeRate).toBeUndefined();
    },
  );
  it("matches the actual CCC method with serialized witnesses", async () => {
    const tx = ccc.Transaction.from({ witnesses: ["0x1234"] });
    tx.getInputsCapacity = async () => n(1001);
    tx.getOutputsCapacity = () => n(1000);
    const client = {} as ccc.Client;
    expect(
      getSnapshotFee(1, n(1001), n(1000), tx.toBytes().length).feeRate,
    ).toBe(await tx.getFeeRate(client));
  });
});
