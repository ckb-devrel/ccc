import type React from "react";
import { expect, it, vi } from "vitest";
import { useFollowOutput } from "../src/app/hooks/useFollowOutput";
const state = vi.hoisted(() => ({ updates: [] as boolean[] }));
vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (value: boolean) => [
    value,
    (next: boolean) => state.updates.push(next),
  ],
}));
const touch = (y: number) =>
  ({
    touches: [{ clientY: y }],
  }) as unknown as React.TouchEvent<HTMLDivElement>;
it("pauses after cumulative small upward scroll gestures, not tiny jitter", () => {
  state.updates.length = 0;
  const { inputHandlers } = useFollowOutput("test");
  inputHandlers.onTouchStart(touch(100));
  inputHandlers.onTouchMove(touch(102));
  expect(state.updates).toEqual([]);
  inputHandlers.onTouchMove(touch(104));
  expect(state.updates).toEqual([false]);
});
it("resets the reference on direction reversal and a new touch", () => {
  state.updates.length = 0;
  const { inputHandlers } = useFollowOutput("test");
  inputHandlers.onTouchStart(touch(100));
  for (const y of [102, 99, 101, 98, 100]) {
    inputHandlers.onTouchMove(touch(y));
  }
  expect(state.updates).toEqual([]);
  inputHandlers.onTouchStart(touch(200));
  inputHandlers.onTouchMove(touch(202));
  expect(state.updates).toEqual([]);
  inputHandlers.onTouchMove(touch(204));
  expect(state.updates).toEqual([false]);
});
