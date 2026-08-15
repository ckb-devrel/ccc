export type Constructor<
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends any[] = any[],
> = new (...args: Args) => T;

export type AbstractConstructor<
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends any[] = any[],
> = abstract new (...args: Args) => T;
