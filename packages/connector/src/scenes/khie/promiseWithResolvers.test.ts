import { describe, expect, it } from "vitest";
import { ensurePromiseWithResolvers } from "./promiseWithResolvers.js";

describe("ensurePromiseWithResolvers", () => {
  it("installs Promise.withResolvers when it is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(Promise, "withResolvers");

    try {
      Object.defineProperty(Promise, "withResolvers", {
        configurable: true,
        value: undefined,
        writable: true,
      });

      await ensurePromiseWithResolvers();

      expect(Reflect.get(Promise, "withResolvers")).toBeTypeOf("function");
    } finally {
      if (original) {
        Object.defineProperty(Promise, "withResolvers", original);
      } else {
        Reflect.deleteProperty(Promise, "withResolvers");
      }
    }
  });
});
