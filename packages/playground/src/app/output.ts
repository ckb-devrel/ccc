import { ccc } from "@ckb-ccc/ccc";
import { isValidElement } from "react";

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

/** Freeze supported mutable CCC values before the user's code continues.
 * Arbitrary custom/React values retain their original semantics.
 */
export function snapshotOutput(values: unknown[]): unknown[] {
  const seen = new WeakMap<object, unknown>();
  const diagnostic = () =>
    new Error(
      "Unable to display this value: reading or snapshotting it failed.",
    );
  function read(value: object, key: string | number): unknown {
    try {
      return snapshot((value as Record<string | number, unknown>)[key]);
    } catch {
      return diagnostic();
    }
  }
  function snapshot(value: unknown): unknown {
    try {
      return snapshotValue(value);
    } catch {
      if (value !== null && typeof value === "object") {
        seen.delete(value);
      }
      return diagnostic();
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
) {
  return [
    level,
    title,
    snapshotOutput(values),
    id,
    client,
    isExampleWallet,
  ] as const;
}
