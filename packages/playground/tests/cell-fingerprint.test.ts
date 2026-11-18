import { ccc } from "@ckb-ccc/ccc";
import { Children, createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CellFingerprint } from "../src/app/components/CellFingerprint";
import { getScriptBagua, getScriptColor } from "../src/app/utils";
const lock = ccc.Script.from({
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x11",
});
it("renders one decorative outer fingerprint for a plain cell", () => {
  const html = renderToStaticMarkup(createElement(CellFingerprint, { lock }));
  expect(html.match(/<svg/g)).toHaveLength(1);
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("cell-fingerprint-type");
});
it("nests the type fingerprint within the lock without explanatory text", () => {
  const type = ccc.Script.from({ ...lock, args: "0x22" });
  const html = renderToStaticMarkup(
    createElement(CellFingerprint, { lock, type }),
  );
  expect(html.match(/<svg/g)).toHaveLength(2);
  expect(html).toContain('class="cell-fingerprint-type"');
  expect(html).not.toContain(">Lock<");
  expect(html).not.toContain(">Type<");
  expect(html).not.toContain("<animate");
});

it("keeps capacity information out of the decorative identity", () => {
  const empty = renderToStaticMarkup(createElement(CellFingerprint, { lock }));
  expect(empty).not.toContain("cell-taiji");
  expect(empty).not.toContain("cell-taiji-ring");
  expect(empty).not.toContain("conic-gradient");
  expect(empty).toContain('fill="none"');
});

it("uses each full script's stable color for its own nested fingerprint", () => {
  const type = ccc.Script.from({ ...lock, args: "0x22" });
  const html = renderToStaticMarkup(
    createElement(CellFingerprint, { lock, type }),
  );
  const [outer, inner] = html.split("</svg>");
  expect(outer).toContain(`fill="${getScriptColor(lock)}"`);
  expect(inner).toContain(`fill="${getScriptColor(type)}"`);
  expect(getScriptColor(ccc.Script.from(lock))).toBe(getScriptColor(lock));
  for (const script of [
    ccc.Script.from({ ...lock, args: "0x22" }),
    ccc.Script.from({ ...lock, hashType: "data" }),
    ccc.Script.from({ ...lock, codeHash: `0x${"11".repeat(32)}` }),
  ]) {
    // Both color and trigram identity derive from the serialized full script.
    expect([getScriptColor(script), getScriptBagua(script)]).not.toEqual([
      getScriptColor(lock),
      getScriptBagua(lock),
    ]);
  }
  expect(getScriptColor(lock)).toMatch(/^hsl\(\d+ 42% 64%\)$/);
});
it("does not invent a type identity for a missing type", () => {
  const html = renderToStaticMarkup(createElement(CellFingerprint, {}));
  expect(html.match(/<svg/g)).toHaveLength(1);
  expect(html).toContain(`fill="${getScriptColor(undefined)}"`);
  expect(html).not.toContain("cell-fingerprint-type");
});
it("retains distinct trigram patterns when two scripts share the same hue", () => {
  const colors = new Map<string, ccc.Script>();
  let collision: [ccc.Script, ccc.Script] | undefined;
  for (let i = 0; i < 1000; i++) {
    const script = ccc.Script.from({
      ...lock,
      args: `0x${i.toString(16).padStart(4, "0")}`,
    });
    const color = getScriptColor(script);
    const previous = colors.get(color);
    if (previous && getScriptBagua(previous) !== getScriptBagua(script)) {
      collision = [previous, script];
      break;
    }
    colors.set(color, script);
  }
  expect(collision).toBeDefined();
  const [first, second] = collision!;
  expect(getScriptColor(first)).toBe(getScriptColor(second));
  expect(getScriptBagua(first)).not.toBe(getScriptBagua(second));
  expect(
    renderToStaticMarkup(createElement(CellFingerprint, { lock: first })),
  ).not.toBe(
    renderToStaticMarkup(createElement(CellFingerprint, { lock: second })),
  );
});

it("keeps identical outer geometry and balanced gaps without losing fingerprint bits", () => {
  const type = ccc.Script.from({ ...lock, args: "0x22" });
  for (const scripts of [{ lock }, { lock, type }]) {
    const html = renderToStaticMarkup(createElement(CellFingerprint, scripts));
    const rings = html.match(/<svg[\s\S]*?<\/svg>/g)!;
    const sources = scripts.type ? [lock, scripts.type] : [lock];
    rings.forEach((ring, i) => {
      const bits = Number(getScriptBagua(sources[i])) & 0xffffff;
      const broken = bits.toString(2).replace(/0/g, "").length;
      expect(ring.match(/<path/g)).toHaveLength(25 + broken);
    });
  }
  type Ring = {
    thickness: number;
    padding: number;
    margin: number;
    space: number;
    gapRatio: number;
  };
  const plain = Children.toArray(CellFingerprint({ lock }).props.children)[0];
  const typed = Children.toArray(
    CellFingerprint({ lock, type }).props.children,
  );
  if (
    !isValidElement<Ring>(plain) ||
    !isValidElement<Ring>(typed[0]) ||
    !isValidElement<Ring>(typed[1])
  ) {
    throw new Error("Expected one or two fingerprint rings");
  }
  const outer = typed[0].props;
  const inner = typed[1].props;
  const depth = (ring: Ring) =>
    ring.margin + 3 * ring.thickness + 2 * ring.padding;
  // The type ring is 60% of the unchanged outer box, inset by 20%.
  expect(20 + 0.6 * inner.margin - depth(outer)).toBeCloseTo(2.2);
  expect(Math.abs(outer.thickness - 0.6 * inner.thickness)).toBeLessThan(0.1);
  expect(plain.props).toEqual(outer);
  // A missing type removes only its SVG, never changes the lock path or color.
  const plainSvg = renderToStaticMarkup(
    createElement(CellFingerprint, { lock }),
  ).match(/<svg[\s\S]*?<\/svg>/)![0];
  const typedSvg = renderToStaticMarkup(
    createElement(CellFingerprint, { lock, type }),
  ).match(/<svg[\s\S]*?<\/svg>/)![0];
  expect(plainSvg).toBe(typedSvg);
  expect(outer.padding).toBeCloseTo(inner.padding * 0.6);
  expect(outer.space).toBeCloseTo(inner.space * 0.6);
  // Distance between adjacent slanted sector edges, in outer viewBox units.
  const diagonalGap = (ring: Ring) =>
    (2 * Math.SQRT2 * Math.cos(Math.PI / 8) * ring.space) / (1 + Math.SQRT2);
  expect(Math.abs(diagonalGap(outer) - outer.padding)).toBeLessThan(0.05);
  expect(outer.padding).toBe(1.6);
  expect(outer.gapRatio).toBe(0.16);
  expect(inner.gapRatio).toBe(outer.gapRatio);
  for (const ring of [outer, inner]) {
    const width =
      ((50 - ring.margin - Math.SQRT2 * ring.space) * 2) / (1 + Math.SQRT2);
    for (let row = 0; row < 3; row++) {
      const rowWidth =
        width -
        2 * row * (ring.thickness + ring.padding) * Math.tan(Math.PI / 8);
      const shortEdge =
        (rowWidth * (1 - ring.gapRatio)) / 2 -
        ring.thickness * Math.tan(Math.PI / 8);
      // Even the innermost broken bar has a real trapezoid, not a flipped path.
      expect(shortEdge).toBeGreaterThan(2);
      expect(rowWidth * ring.gapRatio).toBeLessThan(rowWidth * 0.236);
    }
  }
});
