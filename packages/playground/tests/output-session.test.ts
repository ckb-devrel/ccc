import { describe, expect, it } from "vitest";
import { createOutputSessionGate } from "../src/app/outputSession";

describe("output run lifetime", () => {
  it("accepts same-run delayed logs but rejects them after another run begins", async () => {
    const sessions = createOutputSessionGate();
    const first = sessions.begin();
    await Promise.resolve();
    expect(first()).toBe(true);
    const second = sessions.begin();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });
  it("invalidates callbacks on context replacement/unmount without reviving them in later runs", () => {
    const sessions = createOutputSessionGate();
    const previous = sessions.begin();
    sessions.invalidate();
    expect(previous()).toBe(false);
    const next = sessions.begin();
    expect(previous()).toBe(false);
    expect(next()).toBe(true);
    sessions.invalidate();
    expect(next()).toBe(false);
  });
});
