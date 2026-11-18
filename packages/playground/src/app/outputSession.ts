/** Invalidates previous-run callbacks without cancelling arbitrary user JavaScript. */
export function createOutputSessionGate() {
  let generation = 0;
  return {
    invalidate() {
      generation += 1;
    },
    begin() {
      const current = ++generation;
      return () => current === generation;
    },
  };
}
