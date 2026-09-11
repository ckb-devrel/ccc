import { describe, expect, it, vi } from "vitest";
import { OwnerRefCount } from "./refCount.js";
import { OwnerUnique } from "./unique.js";

describe("OwnerRefCount", () => {
  it("disposes the source ownership after the final reference", async () => {
    const dispose = vi.fn(async () => {});
    const first = OwnerRefCount.new("value", dispose);
    const second = first.clone();

    await first.dispose();
    expect(dispose).not.toHaveBeenCalled();
    expect(second.value).toBe("value");

    await second.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledWith("value");
  });

  it("moves the source ownership", async () => {
    const dispose = vi.fn();
    const source = new OwnerUnique("value", dispose);
    const owner = OwnerRefCount.from(source);

    expect(() => source.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );

    await source.dispose();
    expect(dispose).not.toHaveBeenCalled();

    await owner.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("releases each reference only once", async () => {
    const dispose = vi.fn();
    const first = OwnerRefCount.from(new OwnerUnique("value", dispose));
    const second = first.clone();

    await Promise.all([
      first.dispose(),
      first.dispose(),
      second.dispose(),
      second.dispose(),
    ]);

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects access and cloning through a disposed reference", async () => {
    const owner = OwnerRefCount.from(new OwnerUnique("value", () => {}));
    await owner.dispose();

    expect(() => owner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    expect(() => owner.clone()).toThrow(
      "Cannot access a moved or disposed Owner",
    );
  });
});
