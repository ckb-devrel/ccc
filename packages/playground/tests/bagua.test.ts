import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bagua, TrigramLine } from "../src/app/components/Bagua";

describe("compact script fingerprint", () => {
  const render = (value: number) =>
    renderToStaticMarkup(
      createElement(Bagua, {
        value,
        thickness: 100 / 28,
        padding: 100 / 28,
        margin: 0,
        space: 3,
        dim: 1,
        fill: "none",
        stroke: "#88aa99",
        width: 28,
        height: 28,
      }),
    );

  it("keeps all eight trigrams on one shared geometric center", () => {
    const svg = render(0);
    for (let i = 0; i < 8; i++) {
      expect(
        svg.match(new RegExp(`rotate\\(${i * 45} 50 50\\)`, "g")),
      ).toHaveLength(3);
    }
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain("<animate");
  });

  it("retains hash-dependent broken-line fingerprints", () => {
    expect(render(0)).not.toEqual(render(0xffffff));
    expect(render(0).match(/<path /g)).toHaveLength(25);
    expect(render(0xffffff).match(/<path /g)).toHaveLength(49);
  });
  it("retains the default broken gap for other callers and permits a narrower fingerprint gap", () => {
    const renderLine = (gapRatio?: number) =>
      renderToStaticMarkup(
        createElement(TrigramLine, {
          width: 40,
          height: 4.6,
          isBroken: true,
          dim: 1,
          gapRatio,
        }),
      );
    expect(renderLine()).toBe(renderLine(0.236));
    expect(renderLine()).toContain("l 15.280000000000001 0");
    expect(renderLine(0.16)).toContain("l 16.8 0");
    expect(renderLine(0.16)).not.toContain("NaN");
    const custom = renderToStaticMarkup(
      createElement(Bagua, {
        value: 0xffffff,
        thickness: 4.6,
        padding: 1.6,
        margin: 2,
        space: 1.478,
        gapRatio: 0.16,
        dim: 1,
      }),
    );
    expect(custom).not.toContain("gapRatio");
    expect(custom.match(/<path /g)).toHaveLength(49);
  });
});
