import { ccc } from "@ckb-ccc/ccc";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CellCapacity } from "../src/app/components/CellCapacity";
const render = (props: Parameters<typeof CellCapacity>[0]) =>
  renderToStaticMarkup(createElement(CellCapacity, props));
it("shows exact occupied/free breakdown without exaggerating small shares", () => {
  const html = render({
    capacity: ccc.fixedPointFrom(100000),
    occupied: ccc.fixedPointFrom(62),
    hasOutPoint: false,
  });
  expect(html).toContain("99938 CKB");
  expect(html).toContain("width:0.062%");
  expect(html).not.toContain("DAO extra");
});
it("does not draw a false ratio for unknown or insufficient capacity", () => {
  expect(render({ hasOutPoint: true })).not.toContain(
    'class="cell-capacity-meter"',
  );
  const html = render({
    capacity: BigInt(10),
    occupied: BigInt(20),
    hasOutPoint: false,
  });
  expect(html).toContain("below the occupied minimum");
  expect(html).not.toContain('class="cell-capacity-meter"');
});
it("keeps DAO extra separate and handles zero capacity", () => {
  const html = render({
    capacity: BigInt(0),
    occupied: BigInt(0),
    extra: BigInt(12),
    hasOutPoint: true,
  });
  expect(html).toContain("DAO extra");
  expect(html).toContain("0.00000012 CKB");
  expect(html).not.toContain('class="cell-capacity-meter"');
});
it("uses an exact occupancy percentage and omits invalid ratios", async () => {
  const { capacityOccupiedPercent } =
    await import("../src/app/components/capacityRatio");
  expect(capacityOccupiedPercent(BigInt(100), BigInt(25))).toBe(25);
  expect(capacityOccupiedPercent(BigInt(100), BigInt(100))).toBe(100);
  expect(capacityOccupiedPercent(BigInt(100), BigInt(0))).toBe(0);
  expect(capacityOccupiedPercent(BigInt(100), BigInt(101))).toBeUndefined();
  expect(capacityOccupiedPercent(BigInt(100), BigInt(-1))).toBeUndefined();
  expect(capacityOccupiedPercent(undefined, BigInt(25))).toBeUndefined();
});
