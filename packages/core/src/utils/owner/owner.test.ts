import { describe, expect, it, vi } from "vitest";
import { Owner, OwnerMoved } from "./owner.js";
import { OwnerUnique } from "./unique.js";

describe("Owner", () => {
  it("uses a global runtime brand", () => {
    const owner = new OwnerUnique("value", vi.fn());
    const crossPackageOwner = {
      [Symbol.for("@ckb-ccc/core.Owner")]: true,
    };

    expect(Owner.is(owner)).toBe(true);
    expect(Owner.is(crossPackageOwner)).toBe(true);
    expect(Owner.is({ value: "value", map() {}, dispose() {} })).toBe(false);
  });

  it("maps and transfers an ownership claim", async () => {
    const dispose = vi.fn();
    const source = new OwnerUnique("value", dispose);

    const mapped = source.map((value) => ({ value }));

    expect(mapped.value).toEqual({ value: "value" });
    expect(() => source.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    await source.dispose();
    expect(dispose).not.toHaveBeenCalled();

    await mapped.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith("value");
  });

  it("keeps the source active when mapping fails", () => {
    const source = new OwnerUnique("value", vi.fn());
    const error = new Error("mapping failed");

    expect(() =>
      source.map(() => {
        throw error;
      }),
    ).toThrow(error);
    expect(source.value).toBe("value");
  });
});

describe("OwnerMoved", () => {
  it("disposes only once and returns the same result", async () => {
    const dispose = vi.fn(async () => {});
    const owner = new OwnerMoved("value", dispose);

    const first = owner.dispose();
    const second = owner.dispose();

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith("value");
  });

  it("caches a disposal failure", async () => {
    const error = new Error("dispose failed");
    const dispose = vi.fn(() => {
      throw error;
    });
    const owner = new OwnerMoved("value", dispose);

    const first = owner.dispose();
    const second = owner.dispose();

    expect(second).toBe(first);
    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
