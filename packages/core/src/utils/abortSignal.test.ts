import { describe, expect, it } from "vitest";
import { abortSignalAny } from "./abortSignal.js";

describe("abortSignalAny", () => {
  it("combines abort signals when AbortSignal.any is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(AbortSignal, "any");

    try {
      Object.defineProperty(AbortSignal, "any", {
        configurable: true,
        value: undefined,
        writable: true,
      });

      const first = new AbortController();
      const second = new AbortController();
      const combined = abortSignalAny([first.signal, second.signal]);
      const reason = new Error("cancelled");

      second.abort(reason);

      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe(reason);
    } finally {
      if (original) {
        Object.defineProperty(AbortSignal, "any", original);
      } else {
        Reflect.deleteProperty(AbortSignal, "any");
      }
    }
  });
});
