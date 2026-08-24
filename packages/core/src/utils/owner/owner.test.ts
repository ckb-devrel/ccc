import { describe, expect, it, vi } from "vitest";
import { OwnerMoved } from "./owner.js";

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
