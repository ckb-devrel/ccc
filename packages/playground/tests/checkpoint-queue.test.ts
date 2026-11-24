import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckpointQueue } from "../src/app/checkpointQueue";
import { restoreWorkspaceFocus } from "../src/app/workspaceFocus";
const pos = (line: number): [number, number, number, number] => [
  line,
  0,
  line,
  1,
];
afterEach(() => vi.useRealTimers());
describe("execution checkpoint queue", () => {
  it("keeps simultaneous Step checkpoints reachable in order", async () => {
    let next: (() => void) | undefined;
    const lines: (number | undefined)[] = [];
    const q = createCheckpointQueue(false, (p, advance) => {
      lines.push(p?.[0]);
      next = advance;
    });
    const first = q.enqueue(pos(1));
    const second = q.enqueue(pos(2));
    const stale = next!;
    stale();
    stale();
    expect(lines).toEqual([1, 2]);
    next!();
    await Promise.all([first, second]);
    expect(lines).toEqual([1, 2, undefined]);
    q.dispose();
  });
  it("runs concurrent and subsequent checkpoints without timer loss", async () => {
    vi.useFakeTimers();
    const shown = vi.fn();
    const q = createCheckpointQueue(true, shown);
    let complete = false;
    const execution = Promise.all([q.enqueue(pos(1)), q.enqueue(pos(2))]).then(
      async () => {
        await q.enqueue(pos(3));
        complete = true;
      },
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(complete).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    await execution;
    expect(complete).toBe(true);
    expect(shown.mock.calls.filter(([p]) => p).map(([p]) => p[0])).toEqual([
      1, 2, 3,
    ]);
    q.dispose();
  });
  it("manual advance in Run clears only the current timer", async () => {
    vi.useFakeTimers();
    let next: (() => void) | undefined;
    const q = createCheckpointQueue(true, (_, n) => {
      next = n;
    });
    const a = q.enqueue(pos(1)),
      b = q.enqueue(pos(2));
    next!();
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([a, b]);
    expect(vi.getTimerCount()).toBe(0);
    q.dispose();
  });
  it("ending an unawaited render drops its timer without late continuation or rejection", async () => {
    vi.useFakeTimers();
    const resumed = vi.fn(),
      rejected = vi.fn();
    const q = createCheckpointQueue(true, () => {});
    void q.enqueue(pos(1)).then(resumed, rejected);
    void q.enqueue(pos(2)).then(resumed, rejected);
    q.dispose();
    q.dispose();
    void q.enqueue(pos(3)).then(resumed, rejected);
    await vi.runAllTimersAsync();
    expect(resumed).not.toHaveBeenCalled();
    expect(rejected).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("Promise.race may finish the script without advancing the losing checkpoint", async () => {
    vi.useFakeTimers();
    let next: (() => void) | undefined;
    const q = createCheckpointQueue(false, (_, n) => {
      next = n;
    });
    const loser = vi.fn();
    const execution = Promise.race([
      q.enqueue(pos(1)),
      q.enqueue(pos(2)).then(loser),
    ]);
    next!();
    await execution;
    q.dispose();
    await vi.runAllTimersAsync();
    expect(loser).not.toHaveBeenCalled();
  });
});
it("restores mounted trigger or stable wallet fallback", () => {
  const original = { isConnected: true, focus: vi.fn() };
  const fallback = { focus: vi.fn() };
  restoreWorkspaceFocus(
    original as unknown as HTMLElement,
    fallback as unknown as HTMLElement,
  );
  expect(original.focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(fallback.focus).not.toHaveBeenCalled();
  original.isConnected = false;
  restoreWorkspaceFocus(
    original as unknown as HTMLElement,
    fallback as unknown as HTMLElement,
  );
  expect(fallback.focus).toHaveBeenCalledWith({ preventScroll: true });
});
