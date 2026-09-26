import { Zero } from "../fixedPoint/index.js";
import { NumLike, numFrom, numToHex, type Num } from "../num/index.js";

export * from "./abortSignal.js";
export * from "./constructor.js";
export * from "./owner/index.js";
export * from "./proxy.js";

/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: undefined,
): undefined;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(transformer: (val: T) => R, value: null): undefined;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(transformer: (val: T) => R, value: T): R;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: T | undefined,
): R | undefined;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: T | null,
): R | undefined;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: undefined | null,
): undefined;
/**
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: T | undefined | null,
): R | undefined;
/**
 * A type safe way to apply a transformer on a value if it's not empty.
 * @public
 *
 * @param transformer - The transformer.
 * @param value - The value to be transformed.
 * @returns If the value is empty, it becomes undefined. Otherwise it will be transformed.
 */
export function apply<T, R>(
  transformer: (val: T) => R,
  value: T | undefined | null,
): R | undefined {
  if (value == null) {
    return undefined;
  }

  return transformer(value);
}

/**
 * Similar to Array.reduce, but works on any iterable.
 * @public
 *
 * @param values - The value or iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @returns The accumulated result.
 */
export function reduce<T>(
  values: T | Iterable<T>,
  accumulator: (a: T, b: T, i: number) => T | undefined | null | void,
): T;
/**
 * Similar to Array.reduce, but works on any iterable.
 * @public
 *
 * @param values - The value or iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export function reduce<T, V>(
  values: V | Iterable<V>,
  accumulator: (a: T, b: V, i: number) => T | undefined | null | void,
  init: T,
): T;
/**
 * Similar to Array.reduce, but works on any iterable.
 * @public
 *
 * @param values - The value or iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export function reduce<T, V>(
  values: T | Iterable<T> | V | Iterable<V>,
  accumulator: (a: T, b: T | V, i: number) => T | undefined | null | void,
  init?: T,
): T {
  const hasInit = arguments.length > 2;

  let acc: T = init as T; // The compiler thinks `acc` isn't assigned without this. Since `T` might be nullable, we should not use non-null assertion here.
  let i = 0;

  const iterable: Iterable<T> | Iterable<V> =
    values != null && Symbol.iterator in Object(values)
      ? (values as Iterable<T> | Iterable<V>)
      : ([values] as T[] | V[]);

  for (const value of iterable) {
    if (!hasInit && i === 0) {
      acc = value as T;
      i++;
      continue;
    }

    acc = accumulator(acc, value, i) ?? acc;
    i++;
  }

  if (!hasInit && i === 0) {
    throw new TypeError("Reduce of empty iterator with no initial value");
  }

  return acc;
}

/**
 * Similar to Array.reduce, but works on async iterables and the accumulator can return a Promise.
 * @public
 *
 * @param values - The value, iterable, or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @returns The accumulated result.
 */
export async function reduceAsync<T>(
  values: T | Iterable<T> | AsyncIterable<T>,
  accumulator: (
    a: T,
    b: T,
    i: number,
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
): Promise<T>;
/**
 * Similar to Array.reduce, but works on async iterables and the accumulator can return a Promise.
 * @public
 *
 * @param values - The value, iterable, or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values: V | Iterable<V> | AsyncIterable<V>,
  accumulator: (
    a: T,
    b: V,
    i: number,
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
  init: T | Promise<T>,
): Promise<T>;
/**
 * Similar to Array.reduce, but works on async iterables and the accumulator can return a Promise.
 * @public
 *
 * @param values - The value, iterable, or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values:
    T | Iterable<T> | AsyncIterable<T> | V | Iterable<V> | AsyncIterable<V>,
  accumulator: (
    a: T,
    b: T | V,
    i: number,
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
  init?: T | Promise<T>,
): Promise<T> {
  const hasInit = arguments.length > 2;

  let acc: T = (await Promise.resolve(init)) as T; // The compiler thinks `acc` isn't assigned without this. Since `T` might be nullable, we should not use non-null assertion here.
  let i = 0;

  const iterable:
    Iterable<T> | AsyncIterable<T> | Iterable<V> | AsyncIterable<V> =
    values != null && Symbol.asyncIterator in Object(values)
      ? (values as AsyncIterable<T> | AsyncIterable<V>)
      : values != null && Symbol.iterator in Object(values)
        ? (values as Iterable<T> | Iterable<V>)
        : ([values] as T[] | V[]);

  for await (const value of iterable) {
    if (!hasInit && i === 0) {
      acc = value as T;
      i++;
      continue;
    }

    acc = (await accumulator(acc, value, i)) ?? acc;
    i++;
  }

  if (!hasInit && i === 0) {
    throw new TypeError("Reduce of empty iterator with no initial value");
  }

  return acc;
}

/**
 * Waits for the given duration, rejecting with the abort reason if cancelled.
 * @public
 */
export function sleep(ms: NumLike, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();

    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason);
    };
    const timeout = setTimeout(
      () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      },
      Number(numFrom(ms)),
    );
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type RetryOptions = {
  /** Repeats indefinitely with this delay after the delay iterable is exhausted. */
  repeat?: NumLike;
  /** Cancels waiting between attempts. */
  signal?: AbortSignal;
};

/** A result returned by a retry operation. @public */
export type RetryResult<T> =
  | { status: "resolved"; value: T }
  | { status: "rejected"; error: unknown }
  | { status: "retry"; value?: never };

/** Values available to each retry attempt. @public */
export type RetryOperationOptions<T> = {
  /** Zero-based attempt index. */
  index: number;
  resolve: (value: T) => RetryResult<T>;
  reject: (error: unknown) => RetryResult<T>;
  next: () => RetryResult<never>;
};

function retryResolve<T>(value: T): RetryResult<T> {
  return { status: "resolved", value };
}

function retryReject(error: unknown): RetryResult<never> {
  return { status: "rejected", error };
}

function retryAgain(): RetryResult<never> {
  return { status: "retry" };
}

/**
 * Retries an asynchronous operation when it throws. The iterable supplies one
 * delay per retry and stops retrying when it is exhausted unless `repeat` is
 * configured. Returning `resolve(value)` or `reject(error)` settles
 * immediately. Returning `next()` consumes the next delay without throwing
 * an error.
 * @public
 */
export async function retry<T>(
  delays: Iterable<NumLike>,
  operation: (
    options: RetryOperationOptions<T>,
  ) => PromiseLike<RetryResult<T>> | RetryResult<T>,
  options?: RetryOptions,
): Promise<T> {
  const iterator = delays[Symbol.iterator]();
  let index = 0;

  while (true) {
    options?.signal?.throwIfAborted();

    let result: RetryResult<T>;
    try {
      result = await operation({
        index,
        resolve: retryResolve,
        reject: retryReject,
        next: retryAgain,
      });
      if (result.status === "retry") {
        throw new Error("Retry limit exhausted");
      }
    } catch (cause) {
      const next = iterator.next();
      const delay = next.done ? options?.repeat : next.value;
      if (delay === undefined) {
        throw cause;
      }
      await sleep(delay, options?.signal);
      index += 1;
      continue;
    }

    if (result.status === "rejected") {
      throw result.error;
    }

    return result.value;
  }
}

/**
 * Waits until the current browser page is visible and the browser reports it
 * is online. This does not guarantee that a remote endpoint is reachable.
 * Resolves immediately outside a browser and rejects with the abort reason
 * when the optional signal is aborted.
 * @public
 */
export async function waitForAvailability(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();

  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return;
  }

  const isAvailable = () =>
    document.visibilityState === "visible" && navigator.onLine;
  if (isAvailable()) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    function cleanup() {
      document.removeEventListener("visibilitychange", onAvailabilityChange);
      window.removeEventListener("online", onAvailabilityChange);
      signal?.removeEventListener("abort", onAbort);
    }

    function onAvailabilityChange() {
      if (settled || !isAvailable()) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    }

    function onAbort() {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(signal?.reason);
    }

    document.addEventListener("visibilitychange", onAvailabilityChange);
    window.addEventListener("online", onAvailabilityChange);
    signal?.addEventListener("abort", onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
    } else {
      onAvailabilityChange();
    }
  });
}

/**
 * @public
 */
export function isWebview(userAgent: string): boolean {
  return /webview|wv|ip((?!.*Safari)|(?=.*like Safari))/i.test(userAgent);
}

/**
 * @public
 */
export function stringify(val: unknown) {
  return JSON.stringify(val, (_, value) => {
    if (typeof value === "bigint") {
      return numToHex(value);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  });
}

/**
 * Calculate the greatest common divisor (GCD) of two NumLike values using the Euclidean algorithm.
 *
 * @param a - First operand.
 * @param b - Second operand.
 * @returns GCD(a, b) as a Num.
 */
export function gcd(a: NumLike, b: NumLike): Num {
  a = numFrom(a);
  b = numFrom(b);
  a = a < Zero ? -a : a;
  b = b < Zero ? -b : b;
  while (b !== Zero) {
    [a, b] = [b, a % b];
  }
  return a;
}
