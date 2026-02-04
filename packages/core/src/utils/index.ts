import { NumLike, numFrom, numToHex } from "../num/index.js";

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
 * @param values - The iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @returns The accumulated result.
 */
export function reduce<T>(
  values: Iterable<T>,
  accumulator: (a: T, b: T, i: number) => T | undefined | null | void,
): T;
/**
 * Similar to Array.reduce, but works on any iterable.
 * @public
 *
 * @param values - The iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export function reduce<T, V>(
  values: Iterable<V>,
  accumulator: (a: T, b: V, i: number) => T | undefined | null | void,
  init: T,
): T;
/**
 * Similar to Array.reduce, but works on any iterable.
 * @public
 *
 * @param values - The iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export function reduce<T, V>(
  values: Iterable<T> | Iterable<V>,
  accumulator: (a: T, b: T | V, i: number) => T | undefined | null | void,
  init?: T,
): T {
  const hasInit = arguments.length > 2;

  let acc: T = init as T; // The compiler thinks `acc` isn't assigned without this. Since `T` might be nullable, we should not use non-null assertion here.
  let i = 0;

  for (const value of values) {
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
 * @param values - The iterable or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @returns The accumulated result.
 */
export async function reduceAsync<T>(
  values: Iterable<T> | AsyncIterable<T>,
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
 * @param values - The iterable or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values: Iterable<V> | AsyncIterable<V>,
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
 * @param values - The iterable or async iterable to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null or undefined, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values: Iterable<T> | AsyncIterable<T> | Iterable<V> | AsyncIterable<V>,
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

  for await (const value of values) {
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

export function sleep(ms: NumLike) {
  return new Promise((resolve) => setTimeout(resolve, Number(numFrom(ms))));
}

export type Constructor<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
};

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
