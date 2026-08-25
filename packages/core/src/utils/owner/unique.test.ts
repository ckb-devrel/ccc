import { describe, expect, it, vi } from "vitest";
import { Owner, OwnerMoved } from "./owner.js";
import { OwnerUnique } from "./unique.js";

class OwnerTransferred<T> extends Owner<T> {
  private readonly moved: OwnerMoved<T>;
  protected readonly value_: T;

  private constructor(moved: OwnerMoved<T>) {
    super();
    this.moved = moved;
    this.value_ = moved.value;
  }

  static from<T>(owner: Owner<T>): OwnerTransferred<T> {
    return new OwnerTransferred(this.moveFrom(owner));
  }

  protected release() {
    return this.moved.dispose();
  }
}

describe("OwnerUnique", () => {
  it("exposes and disposes its value", async () => {
    const dispose = vi.fn();
    const owner = new OwnerUnique("value", dispose);

    expect(owner.value).toBe("value");
    await owner.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith("value");
    expect(() => owner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
  });

  it("invalidates access before asynchronous disposal completes", async () => {
    let finishDispose: (() => void) | undefined;
    const owner = new OwnerUnique(
      "value",
      () =>
        new Promise<void>((resolve) => {
          finishDispose = resolve;
        }),
    );

    const disposing = owner.dispose();

    expect(() => owner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    await vi.waitFor(() => expect(finishDispose).toBeDefined());
    finishDispose?.();
    await disposing;
  });

  it("disposes only once and returns the same result", async () => {
    const dispose = vi.fn(async () => {});
    const owner = new OwnerUnique("value", dispose);

    const first = owner.dispose();
    const second = owner.dispose();

    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("moves ownership without disposing the value", async () => {
    const dispose = vi.fn();
    const first = new OwnerUnique("value", dispose);
    const second = OwnerTransferred.from(first);

    expect(dispose).not.toHaveBeenCalled();
    expect(() => first.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    expect(() => OwnerTransferred.from(first)).toThrow(
      "Owner has already been moved or disposed",
    );
    expect(second.value).toBe("value");

    await first.dispose();
    expect(dispose).not.toHaveBeenCalled();

    await second.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("caches a disposal failure", async () => {
    const error = new Error("dispose failed");
    const dispose = vi.fn(() => {
      throw error;
    });
    const owner = new OwnerUnique("value", dispose);

    const first = owner.dispose();
    const second = owner.dispose();

    expect(second).toBe(first);
    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(dispose).toHaveBeenCalledOnce();
  });
});
