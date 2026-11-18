import { ccc } from "@ckb-ccc/core";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { Schema } from "./compile.js";

it("compiles the upstream CKB blockchain schema and matches Script wire bytes", () => {
  const source = readFileSync(
    new URL("./fixtures/blockchain.mol", import.meta.url),
    "utf8",
  );
  const codecs = Schema.from(source);
  const hash = `0x${"ab".repeat(32)}`;
  const value = { code_hash: hash, hash_type: "0x01", args: "0x1234" };
  const script = ccc.Script.from({
    codeHash: hash,
    hashType: "type",
    args: "0x1234",
  });
  expect(codecs.get("Script").encode(value)).toEqual(script.toBytes());
  expect(codecs.get("Script").decode(script.toBytes())).toEqual(value);
  expect(
    codecs
      .get("WitnessArgs")
      .decode(codecs.get("WitnessArgs").encode({ lock: "0x12" })),
  ).toEqual({ lock: "0x12", input_type: undefined, output_type: undefined });
  expect(codecs.get("Header").byteLength).toBe(208);
  expect(codecs.get("Block").byteLength).toBeUndefined();
});
