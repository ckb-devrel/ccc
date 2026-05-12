/**
 * Iterate through an array and run an async function on each item with concurrency control.
 *
 * @param items - The items to iterate through
 * @param concurrency - The maximum number of concurrent executions
 * @param fn - The async function to run on each item
 * @returns An array of results in the same order as the inputs
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(
      `Concurrency must be a positive integer, got: ${concurrency}`,
    );
  }

  const results: R[] = new Array<R>(items.length);
  let nextIndex = 0;
  let hasError = false;

  async function worker() {
    while (nextIndex < items.length && !hasError) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        hasError = true;
        throw err;
      }
    }
  }

  // Launch workers
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
