import { describe, expect, it, vi } from "vitest";
import { OwnerAggregated } from "./aggregated.js";
import { OwnerUnique } from "./unique.js";

describe("OwnerAggregated", () => {
  it("moves heterogeneous ownership claims", async () => {
    const disposeString = vi.fn();
    const disposeNumber = vi.fn();
    const stringOwner = new OwnerUnique("value", disposeString);
    const numberOwner = new OwnerUnique(42, disposeNumber);

    const owner = OwnerAggregated.from([stringOwner, numberOwner] as const);

    expect(owner.value).toEqual(["value", 42]);
    expect(() => stringOwner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    await Promise.all([stringOwner.dispose(), numberOwner.dispose()]);
    expect(disposeString).not.toHaveBeenCalled();
    expect(disposeNumber).not.toHaveBeenCalled();

    await owner.dispose();
    expect(disposeString).toHaveBeenCalledOnce();
    expect(disposeNumber).toHaveBeenCalledOnce();
  });

  it("rejects duplicate Owners before moving them", () => {
    const source = new OwnerUnique("value", vi.fn());

    expect(() => OwnerAggregated.from([source, source])).toThrow(
      "Cannot aggregate the same Owner more than once",
    );
    expect(source.value).toBe("value");
  });

  it("validates every Owner before moving any of them", async () => {
    const active = new OwnerUnique("active", vi.fn());
    const disposed = new OwnerUnique("disposed", vi.fn());
    await disposed.dispose();

    expect(() => OwnerAggregated.from([active, disposed])).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    expect(active.value).toBe("active");
  });

  it("waits for every Owner and aggregates disposal failures", async () => {
    const firstError = new Error("first failed");
    const secondError = new Error("second failed");
    const disposeFirst = vi.fn(() => {
      throw firstError;
    });
    const disposeSecond = vi.fn(() => {
      throw secondError;
    });
    const owner = OwnerAggregated.from([
      new OwnerUnique("first", disposeFirst),
      new OwnerUnique("second", disposeSecond),
    ]);

    await expect(owner.dispose()).rejects.toMatchObject({
      errors: [firstError, secondError],
    });
    expect(disposeFirst).toHaveBeenCalledOnce();
    expect(disposeSecond).toHaveBeenCalledOnce();
  });
});
