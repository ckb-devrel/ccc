import { NumLike, numFrom } from "../num/index.js";

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
 * Similar to Array.reduce, but the accumulator can returns Promise.
 * @public
 *
 * @param values - The array to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null, the previous result will be kept.
 * @returns The accumulated result.
 */
export async function reduceAsync<T>(
  values: T[],
  accumulator: (
    a: T,
    b: T,
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
): Promise<T>;
/**
 * Similar to Array.reduce, but the accumulator can returns Promise.
 * @public
 *
 * @param values - The array to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values: V[],
  accumulator: (
    a: T,
    b: V,
    i: number,
    values: V[],
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
  init: T | Promise<T>,
): Promise<T>;
/**
 * Similar to Array.reduce, but the accumulator can returns Promise.
 * @public
 *
 * @param values - The array to be reduced.
 * @param accumulator - A callback to be called for each value. If it returns null, the previous result will be kept.
 * @param init - The initial value.
 * @returns The accumulated result.
 */
export async function reduceAsync<T, V>(
  values: (V | T)[],
  accumulator: (
    a: T,
    b: T | V,
    i: number,
    values: (V | T)[],
  ) => Promise<T | undefined | null | void> | T | undefined | null | void,
  init?: T | Promise<T>,
): Promise<T> {
  if (init === undefined) {
    if (values.length === 0) {
      throw new TypeError("Reduce of empty array with no initial value");
    }
    init = values[0] as T;
    values = values.slice(1);
  }

  return values.reduce(
    (current: Promise<T>, b: T | V, i, array) =>
      current.then((v) =>
        Promise.resolve(accumulator(v, b, i, array)).then((r) => r ?? v),
      ),
    Promise.resolve(init),
  );
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
