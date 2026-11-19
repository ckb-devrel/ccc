import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";
const text = readFileSync(
  new URL("../src/app/components/Editor.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "Editor.tsx",
  text,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const expressions: Record<string, string> = {};
function visit(node: ts.Node) {
  if (
    ts.isJsxSelfClosingElement(node) &&
    node.tagName.getText(ast) === "MonacoEditor"
  ) {
    for (const attr of node.attributes.properties)
      if (
        ts.isJsxAttribute(attr) &&
        attr.initializer &&
        ts.isJsxExpression(attr.initializer) &&
        attr.initializer.expression
      )
        expressions[attr.name.getText(ast)] =
          attr.initializer.expression.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
it("keeps the saved editor value while imports are loading, ignoring loading-time Monaco changes", () => {
  const onChange = vi.fn();
  const value = new Function(
    "isLoading",
    "value",
    `return (${expressions.value});`,
  )(true, "saved marker");
  expect(value).toBe("saved marker");
  const handler = new Function(
    "isLoading",
    "onChange",
    ts.transpile(`return (${expressions.onChange});`),
  )(true, onChange);
  handler("");
  expect(onChange).not.toHaveBeenCalled();
  new Function(
    "isLoading",
    "onChange",
    ts.transpile(`return (${expressions.onChange});`),
  )(
    false,
    onChange,
  )("edit");
  expect(onChange).toHaveBeenCalledExactlyOnceWith("edit");
});
it("reports local-storage failure without disabling later autosave attempts", () => {
  const page = readFileSync(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );
  const a = page.indexOf('    if (!ready || origin !== "Local draft")');
  const b = page.indexOf("\n  }, [source, origin, ready]);", a);
  const setter = vi.fn(),
    setItem = vi.fn().mockImplementationOnce(() => {
      throw Error("quota");
    });
  const save = new Function(
    "ready",
    "origin",
    "source",
    "window",
    "setSavedDraft",
    ts.transpile(page.slice(a, b)),
  );
  save(true, "Local draft", "new", { localStorage: { setItem } }, setter);
  expect(setter).toHaveBeenLastCalledWith(undefined);
  save(true, "Local draft", "later", { localStorage: { setItem } }, setter);
  expect(setter).toHaveBeenLastCalledWith("later");
  expect(page).toContain("not saved — use Save to download");
});
