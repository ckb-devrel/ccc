/**
 * Creates a signal that aborts when any of the input signals aborts.
 *
 * Uses the native `AbortSignal.any` when available and falls back to an
 * `AbortController` implementation for older runtimes.
 *
 * @public
 */
export function abortSignalAny(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([...signals]);
  }

  const controller = new AbortController();
  const listeners = new Map<AbortSignal, () => void>();
  const cleanup = () => {
    for (const [signal, listener] of listeners) {
      signal.removeEventListener("abort", listener);
    }
    listeners.clear();
  };
  const abortFrom = (signal: AbortSignal) => {
    cleanup();
    controller.abort(signal.reason);
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    if (listeners.has(signal)) {
      continue;
    }

    const listener = () => abortFrom(signal);
    listeners.set(signal, listener);
    signal.addEventListener("abort", listener, { once: true });
  }

  return controller.signal;
}
