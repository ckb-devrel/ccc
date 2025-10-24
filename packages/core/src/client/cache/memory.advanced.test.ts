import { describe, expect, it } from "vitest";
import { MapLru } from "./memory.advanced.js";

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
