import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyOutput } from "../src/app/components/EmptyOutput";

const render = (hasRun: boolean, isRunning: boolean, runBlocked = false) =>
  renderToStaticMarkup(
    createElement(EmptyOutput, {
      hasRun,
      isRunning,
      runBlocked,
      onRun: vi.fn(),
    }),
  );

describe("empty output execution state", () => {
  it("offers initial guidance before the first execution", () => {
    expect(render(false, false)).toContain("AWAITING EXECUTION");
    expect(render(false, false)).toContain("Run code");
  });
  it("does not claim a running silent script is awaiting execution", () => {
    const html = render(true, true);
    expect(html).toContain("Waiting for output");
    expect(html).not.toContain("AWAITING EXECUTION");
    expect(html).not.toContain("<button");
  });
  it("does not show onboarding after a silent run or Clear", () => {
    const html = render(true, false);
    expect(html).toContain("No output to display.");
    expect(html).toContain("Run again");
    expect(html).not.toContain("AWAITING EXECUTION");
  });
  it.each([false, true])(
    "disables the Console run action while the wallet network differs (hasRun=%s)",
    (hasRun) => {
      expect(render(hasRun, false, true)).toMatch(/<button[^>]*disabled/);
      expect(render(hasRun, false)).not.toMatch(/<button[^>]*disabled/);
    },
  );
});
