import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRANSFER, REPOSITORY_EXAMPLES } from "../src/app/examples";

const page = readFileSync(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const picker = page.slice(
  page.indexOf("<RepositoryExamples"),
  page.indexOf("/>", page.indexOf("<RepositoryExamples")),
);
const callback = picker
  .slice(picker.indexOf("onLoad={") + "onLoad={".length)
  .trim()
  .slice(0, -1);
function run(allowed: boolean, loading = false) {
  const confirm = vi.fn(() => allowed),
    loadSource = vi.fn();
  const onLoad = new Function(
    "window",
    "isLoading",
    "loadSource",
    ts.transpile(`return (${callback});`, { target: ts.ScriptTarget.ES2022 }),
  )({ confirm }, loading, loadSource);
  onLoad(REPOSITORY_EXAMPLES[0].sourceUrl);
  return { confirm, loadSource };
}
describe("uniform remote examples picker", () => {
  it("keeps the original initial editor and removes local picker shortcuts", () => {
    expect(page).toContain("useState(DEFAULT_TRANSFER)");
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
  it("cancel performs no loading or replacement; confirmation uses the shared loader", () => {
    expect(run(false).loadSource).not.toHaveBeenCalled();
    const result = run(true);
    expect(result.confirm).toHaveBeenCalledWith(
      "Load this repository example into the editor? Your saved local draft will be kept.",
    );
    expect(result.loadSource).toHaveBeenCalledExactlyOnceWith(
      REPOSITORY_EXAMPLES[0].sourceUrl,
      true,
    );
  });
  it("removes only the DevRel social links", () => {
    expect(page).not.toContain("x.com/CKBDevrel");
    expect(page).not.toContain("CKB DevRel");
    expect(page).toContain("https://faucet.nervos.org/");
    expect(page).toContain("https://www.nervos.org/");
    expect(page).toContain("https://github.com/ckb-devrel/ccc");
  });
  it("ignores repeated clicks while loading", () => {
    const result = run(true, true);
    expect(result.confirm).not.toHaveBeenCalled();
    expect(result.loadSource).not.toHaveBeenCalled();
  });
});
