import { describe, expect, it, vi } from "vitest";
import { scrollOutputIntoView } from "../src/app/components/scrollOutputIntoView";

function fixture({
  targetTop = 500,
  panelTop = 100,
  scrollTop = 200,
  clientTop = 2,
  margin = "12px",
  scrollHeight = 2000,
  clientHeight = 600,
} = {}) {
  const viewport = {
    scrollTop,
    clientTop,
    scrollHeight,
    clientHeight,
    getBoundingClientRect: () => ({ top: panelTop }),
    scrollTo: vi.fn(),
  };
  const documentScroll = vi.fn();
  const element = {
    closest: vi.fn(() => viewport),
    getBoundingClientRect: () => ({ top: targetTop }),
    scrollIntoView: vi.fn(),
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({ scrollMarginTop: margin }),
        scrollTo: documentScroll,
      },
    },
  };
  return { viewport, element, documentScroll };
}

describe("panel-local inspection scrolling", () => {
  it("accounts for existing scroll, panel position, border and desktop inset", () => {
    const { element, viewport, documentScroll } = fixture();
    scrollOutputIntoView(element as unknown as HTMLElement);
    expect(element.closest).toHaveBeenCalledWith("[data-output-viewport]");
    expect(viewport.scrollTo).toHaveBeenCalledExactlyOnceWith({
      top: 586,
      behavior: "instant",
    });
    expect(element.scrollIntoView).not.toHaveBeenCalled();
    expect(documentScroll).not.toHaveBeenCalled();
  });
  it("leaves room for the mobile sticky tabs", () => {
    const { element, viewport } = fixture({ margin: "64px" });
    scrollOutputIntoView(element as unknown as HTMLElement);
    expect(viewport.scrollTo).toHaveBeenCalledWith({
      top: 534,
      behavior: "instant",
    });
  });
  it.each([
    [{ targetTop: -500 }, 0],
    [{ targetTop: 4000 }, 1400],
    [{ scrollHeight: 400 }, 0],
    [{ margin: "auto" }, 598],
  ])("clamps to the panel range and handles unset margins", (options, top) => {
    const { element, viewport } = fixture(options);
    scrollOutputIntoView(element as unknown as HTMLElement);
    expect(viewport.scrollTo).toHaveBeenCalledWith({
      top,
      behavior: "instant",
    });
  });
  it("does not fall back to scrolling the document without a viewport", () => {
    const { element, viewport, documentScroll } = fixture();
    element.closest = vi.fn(() => null) as unknown as typeof element.closest;
    scrollOutputIntoView(element as unknown as HTMLElement);
    scrollOutputIntoView(null);
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(element.scrollIntoView).not.toHaveBeenCalled();
    expect(documentScroll).not.toHaveBeenCalled();
  });
});
