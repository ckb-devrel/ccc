import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps sticky dialog controls inside desktop and mobile scrollports", () => {
  const css = readFileSync(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  const rules = [
    ...css.matchAll(/\.workbench-dialog \.dialog-heading\s*\{([^}]+)\}/g),
  ];
  expect(rules.length).toBe(2);
  for (const [, body] of rules) {
    const top = body.match(/top:\s*(-?[\d.]+)/);
    expect(top).not.toBeNull();
    expect(Number(top?.[1])).toBeGreaterThanOrEqual(0);
  }
});
