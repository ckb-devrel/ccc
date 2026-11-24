import { ccc } from "@ckb-ccc/ccc";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cell } from "../src/app/components/Cell";
import { TransactionFlow } from "../src/app/components/TransactionFlow";
import { getScriptColor } from "../src/app/utils";

const client = { addressPrefix: "ckt" } as ccc.Client;
const cell = {
  cellOutput: ccc.CellOutput.from({
    capacity: ccc.fixedPointFrom(100),
    lock: { codeHash: `0x${"00".repeat(32)}`, hashType: "type", args: "0x11" },
  }),
  outputData: "0x" as const,
};

describe("transaction inspector overview", () => {
  it("uses a real compact selection button without nesting detail content", () => {
    const html = renderToStaticMarkup(
      createElement(Cell, {
        cell,
        client,
        kind: "Output",
        index: 2,
        onInspect: () => {},
        selected: true,
        inspectorId: "full-width-inspector",
      }),
    );
    expect(html.startsWith("<button")).toBe(true);
    expect(html).toContain(
      `border-left-color:${getScriptColor(cell.cellOutput.lock)}`,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="full-width-inspector"');
    expect(html).toContain("Output 2");
    expect(html).toContain("Close details");
    expect(html).not.toContain("Inspect cell");
    expect(html).not.toContain("cell-detail-body");
    expect(html).not.toContain("<details");
  });
  it("preserves the native details behavior for standalone cells", () => {
    const html = renderToStaticMarkup(createElement(Cell, { cell, client }));
    expect(html.startsWith("<details")).toBe(true);
    expect(html).toContain(
      `border-left-color:${getScriptColor(cell.cellOutput.lock)}`,
    );
    expect(html).toContain("cell-detail-body");
    expect(html).toContain("Lock script");
  });
  it("renders both desktop overview columns, only one arrow, and no native divider tooltip", () => {
    const tx = ccc.Transaction.from({
      outputs: [cell.cellOutput],
      outputsData: ["0x"],
    });
    const html = renderToStaticMarkup(
      createElement(TransactionFlow, { tx, client }),
    );
    expect(html).toContain("transaction-inputs");
    expect(html).toContain("transaction-outputs");
    expect(html).toContain('data-mobile-side="outputs"');
    expect(html).toContain("Resize transaction input and output columns");
    expect(html).not.toContain("grip-vertical");
    expect(html).not.toContain('title="Drag');
    expect(html).not.toContain("cell-detail-body");
  });
});
