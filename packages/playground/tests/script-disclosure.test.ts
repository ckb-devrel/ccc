import { ccc } from "@ckb-ccc/connector-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Address } from "../src/app/components/Address";
import { animateScriptDisclosure } from "../src/app/components/scriptDisclosure";
import { readPlaygroundStyles } from "./read-playground-styles";

const css = readPlaygroundStyles();

describe("script disclosure animation contract", () => {
  it("keeps native details/summary for both default states", () => {
    const address = ccc.Address.from({
      prefix: "ckt",
      script: {
        codeHash: `0x${"00".repeat(32)}`,
        hashType: "type",
        args: "0x",
      },
    });
    for (const isDefaultOpen of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(Address, { address, isDefaultOpen }),
      );
      expect(html).toContain("<summary>Script details</summary>");
      expect(html).toContain(
        isDefaultOpen
          ? '<details class="cell-details" open="">'
          : '<details class="cell-details">',
      );
      expect(html).toContain('class="detail-grid"');
    }
  });
  it("does not race native pseudo-element animation against the controller", () => {
    expect(css).not.toContain(".cell-details::details-content");
    expect(css).not.toContain(".cell-details[open]::details-content");
  });
  it("keeps the same margin-containing formatting context before, during and after animation", () => {
    const details = css.match(/\.cell-details\s*\{([^}]*)\}/)?.[1];
    expect(details).toContain("display: flow-root");
    // Keep the 8px content spacing instead of hiding the end jump by deleting it.
    expect(css).toMatch(/\.detail-grid\s*\{\s*margin: 8px 0;/);
  });
});

// Controller tests intentionally mock layout/WAAPI; actual intermediate pixels
// must additionally be checked in the deployed browser, not inferred from CSS.
function fixture(open = false, reduced = false) {
  const summary = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ height: 28 }),
  });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const animations: {
    onfinish?: () => void;
    cancel: ReturnType<typeof vi.fn>;
  }[] = [];
  let paintedHeight: number | undefined;
  const details = {
    open,
    querySelector: () => summary,
    style: { overflow: "", removeProperty: vi.fn() },
    getBoundingClientRect: () => ({
      height: paintedHeight ?? (details.open ? 196 : 28),
    }),
    animate: vi.fn(
      (_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
        paintedHeight = undefined;
        const animation = {
          cancel: vi.fn(() => {
            paintedHeight = undefined;
          }),
        };
        animations.push(animation);
        return animation;
      },
    ),
  };
  const cleanup = animateScriptDisclosure(
    details as unknown as HTMLDetailsElement,
    motion as unknown as MediaQueryList,
  );
  return {
    details,
    motion,
    animations,
    cleanup,
    paint: (height: number) => {
      paintedHeight = height;
    },
    click: () =>
      summary.dispatchEvent(new Event("click", { cancelable: true })),
  };
}

describe("native Script details animation lifecycle", () => {
  it("animates both directions and keeps open until closing finishes", () => {
    const f = fixture();
    f.click();
    expect(f.details.open).toBe(true);
    expect(f.details.animate.mock.calls[0]).toEqual([
      [{ height: "28px" }, { height: "196px" }],
      { duration: 180, easing: "ease-out", fill: "both" },
    ]);
    f.animations[0].onfinish?.();
    f.click();
    expect(f.details.open).toBe(true);
    expect(f.details.animate.mock.calls[1][0]).toEqual([
      { height: "196px" },
      { height: "28px" },
    ]);
    f.animations[1].onfinish?.();
    expect(f.details.open).toBe(false);
  });
  it("reverses from painted height and ignores stale completion", () => {
    const f = fixture(true);
    f.click();
    f.paint(100);
    f.click();
    expect(f.animations[0].cancel).toHaveBeenCalled();
    expect(f.details.animate.mock.calls[1][0]).toEqual([
      { height: "100px" },
      { height: "196px" },
    ]);
    f.animations[0].onfinish?.();
    expect(f.details.open).toBe(true);
    f.animations[1].onfinish?.();
    expect(f.details.open).toBe(true);
  });
  it("reduced motion toggles immediately and can interrupt an animation", () => {
    const f = fixture(true, true);
    f.click();
    expect(f.details.open).toBe(false);
    expect(f.details.animate).not.toHaveBeenCalled();
    f.motion.matches = false;
    f.click();
    f.motion.matches = true;
    f.motion.dispatchEvent(new Event("change"));
    expect(f.animations[0].cancel).toHaveBeenCalled();
    expect(f.details.open).toBe(true);
  });
  it("cleans up pending animation and leaves native activation available", () => {
    const f = fixture(true);
    expect(f.click()).toBe(false);
    f.cleanup();
    expect(f.details.open).toBe(false);
    expect(f.animations[0].cancel).toHaveBeenCalled();
    expect(f.click()).toBe(true);
  });
});
