import { expect, it } from "vitest";
import { readPlaygroundStyles } from "./read-playground-styles";

it("keeps sticky dialog controls inside desktop and mobile scrollports", () => {
  const css = readPlaygroundStyles();
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
