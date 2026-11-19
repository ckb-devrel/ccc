import { ccc } from "@ckb-ccc/ccc";
import { isValidElement } from "react";
import { MissingWalletError } from "./execute/wallet";

function snapshotAddress(address: ccc.Address) {
  return ccc.Address.from({
    prefix: address.prefix,
    script: address.script.clone(),
  });
}

/** Resolve once at emission, not later from a possibly switched wallet account. */
export class SignerOutputSnapshot {
  readonly result: Promise<{ address: ccc.Address } | { error: unknown }>;
  constructor(signer: ccc.Signer) {
    let replaced = false;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = signer.onReplaced(() => {
        replaced = true;
      });
      this.result = signer
        .getRecommendedAddressObj()
        .then(
          (address) =>
            replaced
              ? {
                  error: new Error(
                    "The wallet account changed before this historical address resolved. Run again to inspect the current wallet.",
                  ),
                }
              : { address: snapshotAddress(address) },
          (error: unknown) => ({ error }),
        )
        .finally(() => unsubscribe?.());
    } catch (error) {
      unsubscribe?.();
      this.result = Promise.resolve({ error });
    }
  }
}

export type OutputOrigin = "script" | "diagnostic";

/** Freeze supported mutable CCC values before the user's code continues.
 * Arbitrary custom/React values retain their original semantics.
 */
export function snapshotOutput(
  values: unknown[],
  origin: OutputOrigin = "diagnostic",
): unknown[] {
  const seen = new WeakMap<object, unknown>();
  function diagnostic(error: unknown) {
    // Only inspecting script output can stop the script. A diagnostic must
    // preserve the original failure, even if one of its fields is a signer.
    if (origin === "script" && MissingWalletError.is(error)) {
      throw error;
    }
    return new Error(
      "Unable to display this value: reading or snapshotting it failed.",
    );
  }
  function read(value: object, key: string | number): unknown {
    try {
      return snapshot((value as Record<string | number, unknown>)[key]);
    } catch (error) {
      return diagnostic(error);
    }
  }
  function snapshot(value: unknown): unknown {
    try {
      return snapshotValue(value);
    } catch (error) {
      if (value !== null && typeof value === "object") {
        seen.delete(value);
      }
      return diagnostic(error);
    }
  }
  function snapshotObject(value: object, prototype: object | null): unknown {
    const result: object = Object.create(prototype);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      // Keep own keys as data even when they shadow a prototype setter.
      Object.defineProperty(result, key, {
        value: read(value, key),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  }
  function snapshotValue(value: unknown): unknown {
    if (value === null || typeof value !== "object" || isValidElement(value)) {
      return value;
    }
    if (seen.has(value)) {
      return seen.get(value);
    }
    if (
      value instanceof ccc.Transaction ||
      value instanceof ccc.Cell ||
      value instanceof ccc.CellInput ||
      value instanceof ccc.CellOutput ||
      value instanceof ccc.Script ||
      value instanceof ccc.OutPoint ||
      value instanceof ccc.CellDep ||
      value instanceof ccc.Address
    ) {
      // CCC's from()/clone() factories may repair insufficient capacity.
      // A debugger snapshot must retain the emitted fields, even when invalid.
      // Only these known data classes are copied; arbitrary classes retain
      // their semantics below. Keep prototypes for their display methods.
      return snapshotObject(value, Object.getPrototypeOf(value));
    }
    if (value instanceof ccc.Signer) {
      return new SignerOutputSnapshot(value);
    }
    if (value instanceof Uint8Array) {
      return value.slice();
    }
    if (Array.isArray(value)) {
      const result: unknown[] = new Array(value.length);
      seen.set(value, result);
      // Enumerate present slots across the prototype chain rather than scanning
      // every hole. Like array iteration, inherited and non-enumerable indices
      // are values too; always read through the original array, once per index.
      const indices = new Set<number>();
      const prototypes = new WeakSet<object>();
      let current: object | null = value;
      while (current && !prototypes.has(current)) {
        prototypes.add(current);
        for (const key of Object.getOwnPropertyNames(current)) {
          const index = Number(key);
          if (
            Number.isInteger(index) &&
            index >= 0 &&
            index < value.length &&
            String(index) === key
          ) {
            indices.add(index);
          }
        }
        current = Object.getPrototypeOf(current);
      }
      for (const index of [...indices].sort((a, b) => a - b)) {
        result[index] = read(value, index);
      }
      return result;
    }
    const prototype: object | null = Object.getPrototypeOf(value);
    // Transaction output cells are native CellAny values. Custom subclasses
    // may rely on private state that cannot be copied from their own keys.
    if (
      prototype === ccc.CellAny.prototype ||
      prototype === Object.prototype ||
      prototype === null
    ) {
      return snapshotObject(value, prototype);
    }
    return value;
  }
  return values.map(snapshot);
}

/** Store wallet mode with the entry, never derive historical labels from live UI. */
export function captureOutputEntry(
  level: "error" | "info",
  title: string,
  values: unknown[],
  id: number,
  client: ccc.Client,
  isExampleWallet: boolean,
  origin: OutputOrigin = "diagnostic",
) {
  return [
    level,
    title,
    snapshotOutput(values, origin),
    id,
    client,
    isExampleWallet,
  ] as const;
}
