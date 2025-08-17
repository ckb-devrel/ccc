import { describe, expect, it } from "vitest";
import { reduce, reduceAsync } from "./index.js";

// Helper to create an async iterable for testing
async function* createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    // Simulate a small delay for each item
    await new Promise((resolve) => setTimeout(resolve, 1));
    yield item;
  }
}

describe("reduce", () => {
  it("should reduce an array of numbers to their sum", () => {
    const values = [1, 2, 3, 4];
    const result = reduce(values, (acc, val) => acc + val);
    expect(result).toBe(10);
  });

  it("should reduce with a given initial value", () => {
    const values = [1, 2, 3, 4];
    const result = reduce(values, (acc, val) => acc + val, 10);
    expect(result).toBe(20);
  });

  it("should handle different accumulator and value types", () => {
    const values = ["a", "bb", "ccc"];
    const result = reduce(values, (acc, val) => acc + val.length, 0);
    expect(result).toBe(6);
  });

  it("should return the initial value for an empty array", () => {
    const values: number[] = [];
    const result = reduce(values, (acc, val) => acc + val, 100);
    expect(result).toBe(100);
  });

  it("should throw a TypeError for an empty array with no initial value", () => {
    const values: number[] = [];
    expect(() => reduce(values, (acc, val) => acc + val)).toThrow(
      "Reduce of empty iterator with no initial value",
    );
  });

  it("should keep the previous result if accumulator returns null or undefined", () => {
    const values = [1, 2, 3, 4];
    const result = reduce(
      values,
      (acc, val) => {
        // Only add odd numbers
        return val % 2 !== 0 ? acc + val : null;
      },
      0,
    );
    // 0+1=1, 1 (ignore 2), 1+3=4, 4 (ignore 4)
    expect(result).toBe(4);
  });

  it("should work with other iterables like Set", () => {
    const values = new Set([1, 2, 3, 4]);
    const result = reduce(values, (acc, val) => acc * val, 1);
    expect(result).toBe(24);
  });

  it("should pass correct index to the accumulator", () => {
    const values = ["a", "b", "c"];
    const indicesWithInit: number[] = [];
    reduce(
      values,
      (_acc, _val, i) => {
        indicesWithInit.push(i);
      },
      "",
    );
    expect(indicesWithInit).toEqual([0, 1, 2]);

    const indicesWithoutInit: number[] = [];
    reduce(values, (_acc, _val, i) => {
      indicesWithoutInit.push(i);
    });
    // First call is for the second element, so index is 1
    expect(indicesWithoutInit).toEqual([1, 2]);
  });
});

describe("reduceAsync", () => {
  it("should work with a sync iterable and sync accumulator", async () => {
    const values = [1, 2, 3, 4];
    const result = await reduceAsync(values, (acc, val) => acc + val);
    expect(result).toBe(10);
  });

  it("should work with a sync iterable and async accumulator", async () => {
    const values = [1, 2, 3, 4];
    const result = await reduceAsync(
      values,
      async (acc, val) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return acc + val;
      },
      0,
    );
    expect(result).toBe(10);
  });

  it("should work with an async iterable and sync accumulator", async () => {
    const values = createAsyncIterable([1, 2, 3, 4]);
    const result = await reduceAsync(values, (acc, val) => acc + val, 0);
    expect(result).toBe(10);
  });

  it("should work with an async iterable and async accumulator", async () => {
    const values = createAsyncIterable([1, 2, 3, 4]);
    const result = await reduceAsync(
      values,
      async (acc, val) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return acc + val;
      },
      0,
    );
    expect(result).toBe(10);
  });

  it("should work with a promise as an initial value", async () => {
    const values = [1, 2, 3, 4];
    const init = Promise.resolve(10);
    const result = await reduceAsync(values, (acc, val) => acc + val, init);
    expect(result).toBe(20);
  });

  it("should throw a TypeError for an empty iterable with no initial value", async () => {
    const values: number[] = [];
    await expect(reduceAsync(values, (acc, val) => acc + val)).rejects.toThrow(
      "Reduce of empty iterator with no initial value",
    );
  });

  it("should return the initial value for an empty async iterable", async () => {
    const values = createAsyncIterable<number>([]);
    const result = await reduceAsync(values, (acc, val) => acc + val, 100);
    expect(result).toBe(100);
  });

  it("should keep previous result if async accumulator returns null", async () => {
    const values = createAsyncIterable([1, 2, 3, 4]);
    const result = await reduceAsync(
      values,
      async (acc, val) => {
        return val % 2 !== 0 ? acc + val : Promise.resolve(null);
      },
      0,
    );
    expect(result).toBe(4);
  });

  it("should pass correct index to the accumulator", async () => {
    const values = ["a", "b", "c"];
    const indicesWithInit: number[] = [];
    await reduceAsync(
      values,
      (acc, _val, i) => {
        indicesWithInit.push(i);
        return acc;
      },
      "",
    );
    expect(indicesWithInit).toEqual([0, 1, 2]);

    const indicesWithoutInit: number[] = [];
    await reduceAsync(values, (acc, _val, i) => {
      indicesWithoutInit.push(i);
      return acc;
    });
    // First call is for the second element, so index is 1
    expect(indicesWithoutInit).toEqual([1, 2]);
  });
});
