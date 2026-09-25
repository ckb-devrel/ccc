import { describe, expect, it } from "vitest";
import {
  MapLru,
  filterCell,
  filterData,
  filterScript,
} from "./memory.advanced.js";

describe("MapLru", () => {
  it("should throw an error for invalid capacity", () => {
    expect(() => new MapLru(0)).toThrow("Capacity must be a positive integer");
    expect(() => new MapLru(-1)).toThrow("Capacity must be a positive integer");
    expect(() => new MapLru(1.5)).toThrow(
      "Capacity must be a positive integer",
    );
  });

  it("should set and get values correctly", () => {
    const cache = new MapLru<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(2);
  });

  it("should evict the least recently used item when capacity is exceeded", () => {
    const cache = new MapLru<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // This should evict "a"

    expect(cache.has("a")).toBe(false);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("should update the recently used status on get, affecting eviction order", () => {
    const cache = new MapLru<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // "a" is now the most recently used
    cache.set("c", 3); // This should evict "b"

    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("should handle deletion correctly", () => {
    const cache = new MapLru<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.delete("a");

    expect(cache.has("a")).toBe(false);
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(1);

    // @ts-expect-error - accessing private property for testing
    expect(cache.lru.has("a")).toBe(false);
  });

  describe("iteration behavior", () => {
    it("should handle LRU updates when an item is accessed during iteration", () => {
      const cache = new MapLru<string, number>(3);
      cache.set("a", 1).set("b", 2).set("c", 3);

      // Initial LRU order: a, b, c (c is MRU)
      // @ts-expect-error - accessing private property for testing
      expect(Array.from(cache.lru.keys())).toEqual(["a", "b", "c"]);

      for (const [key] of cache.entries()) {
        if (key === "b") {
          cache.get("a"); // Access 'a', making it the new MRU
        }
      }

      // Final LRU order should be: b, c, a
      // @ts-expect-error - accessing private property for testing
      expect(Array.from(cache.lru.keys())).toEqual(["b", "c", "a"]);

      // Adding a new item should evict the new LRU item, which is 'b'
      cache.set("d", 4);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("c")).toBe(true);
      expect(cache.has("a")).toBe(true);
      expect(cache.has("d")).toBe(true);
    });

    it("should handle modifications and evictions during iteration", () => {
      const cache = new MapLru<string, number>(3);
      cache.set("a", 1).set("b", 2).set("c", 3);

      // Initial state: keys are [a, b, c], LRU order is [a, b, c]
      const visited: string[] = [];
      // The standard Map iterator will visit newly added items.
      // When we add "d", "a" gets evicted. The iterator, having already passed "a",
      // will continue to "c" and then visit the new item "d".
      for (const [key] of cache.entries()) {
        visited.push(key);
        if (key === "b") {
          cache.set("d", 4); // This will evict 'a'
        }
      }

      expect(visited).toEqual(["a", "b", "c", "d"]);

      // Final state of the cache
      expect(cache.has("a")).toBe(false);
      expect(cache.size).toBe(3);
      expect(Array.from(cache.keys())).toEqual(["b", "c", "d"]);
    });
  });
});

describe("filterData", () => {
  it("should match exact hex data", () => {
    expect(filterData("0xaabbccdd", "0xaabbccdd", "exact")).toBe(true);
    expect(filterData("0xaabbccdd", "0xaabb", "exact")).toBe(false);
    expect(filterData("0x", "0x", "exact")).toBe(true);
    expect(filterData("0xaabb", "0x", "exact")).toBe(false);
    expect(filterData("0x", "0xaabb", "exact")).toBe(false);
    expect(filterData("0xaabbccdd", undefined, "exact")).toBe(true);
  });

  it("should match prefix hex data", () => {
    expect(filterData("0xaabbccdd", "0xaabb", "prefix")).toBe(true);
    expect(filterData("0xaabbccdd", "0xbbcc", "prefix")).toBe(false);
    expect(filterData("0xaabbccdd", "0x", "prefix")).toBe(true);
    expect(filterData("0x", "0x", "prefix")).toBe(true);
    expect(filterData("0x", "0xaabb", "prefix")).toBe(false);
    expect(filterData("0xaabbccdd", undefined, "prefix")).toBe(true);
  });

  it("should match partial hex data at byte boundaries", () => {
    // Interior byte sequence matching (issue #572)
    expect(filterData("0xaabbccdd", "0xbbcc", "partial")).toBe(true);
    expect(filterData("0xaabbccdd", "0xaabb", "partial")).toBe(true);
    expect(filterData("0xaabbccdd", "0xccdd", "partial")).toBe(true);
    expect(filterData("0xaabbccdd", "0xaabbccdd", "partial")).toBe(true);
    expect(filterData("0xaabbccdd", "0xeeff", "partial")).toBe(false);
    expect(filterData("0xaabbccdd", "0x", "partial")).toBe(true);
    expect(filterData("0x", "0x", "partial")).toBe(true);
    expect(filterData("0x", "0xaabb", "partial")).toBe(false);
    expect(filterData("0xaabbccdd", undefined, "partial")).toBe(true);

    // Byte alignment checks: nibble-unaligned sequences must not match
    expect(filterData("0x012345", "0x12", "partial")).toBe(false);
    expect(filterData("0x012123", "0x12", "partial")).toBe(false);
    // Unaligned match followed by aligned match
    expect(filterData("0x012312", "0x12", "partial")).toBe(true);
  });
});

describe("filterScript", () => {
  const SCRIPT_A = {
    codeHash: "0x" + "1".repeat(64),
    hashType: "type" as const,
    args: "0x01020304",
  };

  it("should filter scripts with partial matching on args", () => {
    expect(
      filterScript(
        SCRIPT_A,
        {
          codeHash: "0x" + "1".repeat(64),
          hashType: "type",
          args: "0x0203",
        },
        "partial",
      ),
    ).toBe(true);

    expect(
      filterScript(
        SCRIPT_A,
        {
          codeHash: "0x" + "1".repeat(64),
          hashType: "type",
          args: "0x05",
        },
        "partial",
      ),
    ).toBe(false);

    expect(
      filterScript(
        SCRIPT_A,
        {
          codeHash: "0x" + "2".repeat(64),
          hashType: "type",
          args: "0x0203",
        },
        "partial",
      ),
    ).toBe(false);
  });
});

describe("filterCell", () => {
  it("should match cell with partial outputData filter", () => {
    const cell = {
      cellOutput: {
        capacity: 1000n,
        lock: {
          codeHash: "0x" + "0".repeat(64),
          hashType: "type" as const,
          args: "0x112233",
        },
      },
      outputData: "0xaabbccdd",
      outPoint: {
        txHash: "0x" + "0".repeat(64),
        index: 0,
      },
    };

    expect(
      filterCell(
        {
          script: {
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          },
          scriptType: "lock",
          scriptSearchMode: "prefix",
          filter: {
            outputData: "0xbbcc",
            outputDataSearchMode: "partial",
          },
        },
        cell,
      ),
    ).toBe(true);

    expect(
      filterCell(
        {
          script: {
            codeHash: "0x" + "0".repeat(64),
            hashType: "type",
            args: "0x",
          },
          scriptType: "lock",
          scriptSearchMode: "prefix",
          filter: {
            outputData: "0xeeff",
            outputDataSearchMode: "partial",
          },
        },
        cell,
      ),
    ).toBe(false);
  });
});
