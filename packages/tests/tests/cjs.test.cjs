const assert = require("node:assert/strict");
const { ccc } = require("@ckb-ccc/ccc");
const path = require("path");

assert.ok(ccc, "CCC package should be imported successfully in CJS");
assert.strictEqual(
  require.resolve("@ckb-ccc/ccc"),
  path.join(__dirname, "../../ccc/dist.commonjs/index.js"),
  "CCC package should be imported from dist.commonjs in CJS",
);
console.log("CJS require test passed");
