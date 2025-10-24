import { ccc } from "@ckb-ccc/ccc";
import assert from "node:assert/strict";
import path from "path";

assert.ok(ccc, "CCC package should be imported successfully in ESM");
assert.strictEqual(
  import.meta.resolve("@ckb-ccc/ccc"),
  `file://${path.join(import.meta.dirname, "../../ccc/dist/index.js")}`,
  "CCC package should be imported from dist in ESM",
);
console.log("ESM require test passed");
