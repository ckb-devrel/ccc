import { ccc } from "@ckb-ccc/ccc";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cell } from "../src/app/components/Cell";
import { readPlaygroundStyles } from "./read-playground-styles";

const css = readPlaygroundStyles();
const flowCss = readFileSync(
  new URL("../src/app/components/TransactionFlow.css", import.meta.url),
  "utf8",
);
const cellSource = readFileSync(
  new URL("../src/app/components/Cell.tsx", import.meta.url),
  "utf8",
);
const cell = {
  cellOutput: ccc.CellOutput.from({
    capacity: ccc.fixedPointFrom("123456789.12345678"),
    lock: { codeHash: `0x${"00".repeat(32)}`, hashType: "type", args: "0x11" },
  }),
  outputData: "0x" as const,
};

describe("Cell summary independent text and identity layout", () => {
  it.each([false, true])(
    "groups all text apart from the full fingerprint (selector=%s)",
    (selector) => {
      const html = renderToStaticMarkup(
        createElement(Cell, {
          cell,
          client: { addressPrefix: "ckt" } as ccc.Client,
          onInspect: selector ? () => {} : undefined,
        }),
      );
      expect(html).toContain(
        '<span class="cell-summary-copy"><span class="cell-index">',
      );
      expect(html).toContain("123456789.12345678");
      expect(html).toContain(
        '</span></span><span class="cell-fingerprint" aria-hidden="true">',
      );
    },
  );

  it("wraps the two independent flex items at card width, never as an overlapping watermark", () => {
    const copy = css.match(/\.cell-summary-copy\s*\{([^}]*)\}/)?.[1];
    const fingerprint = css.match(/\.cell-fingerprint\s*\{([^}]*)\}/)?.[1];
    expect(copy).toContain("flex: 1 1 110px");
    expect(copy).toContain("min-width: 0");
    expect(copy).toContain("overflow-wrap: anywhere");
    expect(css).toMatch(
      /\.cell-summary-copy > \*\s*\{\s*min-width: 0;\s*max-width: 100%;/,
    );
    const summaryLayout = css.slice(
      css.indexOf("/* Reserve independent space"),
      css.indexOf(".cell-fingerprint > svg"),
    );
    expect(summaryLayout).not.toContain("overflow: hidden");
    expect(summaryLayout).not.toContain("overflow: clip");
    expect(fingerprint).toContain("position: relative");
    expect(fingerprint).toContain("flex: none");
    expect(fingerprint).not.toContain("transform:");
    expect(fingerprint).not.toContain("z-index:");
    expect(fingerprint).toContain("width: 76px");
    expect(fingerprint).toContain("height: 76px");
    expect(flowCss).toMatch(
      /\.transaction-cell-list \.cell-fingerprint\s*\{\s*width: 72px;\s*height: 72px;/,
    );
    // Layout contract only; deployed browser geometry must also be checked at
    // 174px and 116px card widths, including the longest capacity text.
  });
  it("keeps the optional DAO extra in the wrapping text group, not beside the fingerprint", () => {
    const groupStart = cellSource.indexOf(
      '<span className="cell-summary-copy">',
    );
    const dao = cellSource.indexOf('className="cell-extra"', groupStart);
    const identity = cellSource.indexOf("<CellFingerprint", groupStart);
    expect(dao).toBeGreaterThan(groupStart);
    expect(identity).toBeGreaterThan(dao);
    expect(cellSource.slice(dao, identity)).toContain("CKB DAO extra");
  });
});
