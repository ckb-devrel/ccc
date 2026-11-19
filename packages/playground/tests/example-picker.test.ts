import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSFER, REPOSITORY_EXAMPLES } from "../src/app/examples";

const page = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const dialog = readFileSync(
  new URL("../src/app/components/WorkbenchDialog.tsx", import.meta.url),
  "utf8",
);
describe("uniform remote examples picker", () => {
  it("keeps the original initial editor and removes local picker shortcuts", () => {
    expect(dialog).toContain('onImport(sourceUrl, "example")');
    expect(page).toContain("onImport={sourceDocument.importSource}");
    expect(DEFAULT_TRANSFER).toContain("Welcome to CCC Playground!");
    expect(DEFAULT_TRANSFER).toContain("signer.client.addressPrefix");
    expect(page).not.toContain("Transaction anatomy");
    expect(page).not.toContain("Example · Build a transfer");
    expect(REPOSITORY_EXAMPLES[0].file).toBe("transfer.ts");
    expect(
      REPOSITORY_EXAMPLES.every((example) =>
        example.sourceUrl.startsWith("https://raw.githubusercontent.com/"),
      ),
    ).toBe(true);
  });
  it("removes only the DevRel social links", () => {
    expect(page).not.toContain("x.com/CKBDevrel");
    expect(page).not.toContain("CKB DevRel");
    expect(page).toContain("https://faucet.nervos.org/");
    expect(page).toContain("https://www.nervos.org/");
    expect(page).toContain("https://github.com/ckb-devrel/ccc");
  });
});
