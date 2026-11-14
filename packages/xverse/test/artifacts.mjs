import { ccc } from "@ckb-ccc/core";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const key = new Uint8Array(32).fill(1);
const pub = secp256k1.getPublicKey(key, true);
const payment = btc.p2wpkh(pub, btc.TEST_NETWORK);
const client = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected network request");
    },
  },
});
// Fixture construction/readback only; adapter code enforces its own boundary.
const options = {
  unknown: "ignore",
  proprietary: "ignore",
};
const hex = (tx) => ccc.hexFrom(tx.toPSBT());
function transaction(script = payment.script) {
  const tx = new btc.Transaction(options);
  tx.addInput({
    txid: new Uint8Array(32).fill(1),
    index: 0,
    witnessUtxo: { amount: 10000n, script },
  });
  tx.addOutput({ script: payment.script, amount: 9000n });
  return tx;
}
function createSigner(api, response) {
  const provider = {
    request: async (method) => {
      assert.equal(method, "signPsbt");
      return {
        jsonrpc: "2.0",
        id: "1",
        result: { psbt: ccc.bytesTo(response(), "base64") },
      };
    },
  };
  return new api.Xverse.Signer(client, provider);
}
test("xverse native ESM/CommonJS artifact smoke", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("package.json", root), "utf8"),
  );
  for (const field of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    assert.equal(manifest[field]?.["@ckb-ccc/btc-psbt"], undefined);
  }
  for (const format of ["esm", "cjs"]) {
    const directory = new URL(
      `${format === "esm" ? "dist" : "dist.commonjs"}/`,
      root,
    );
    const files = (await readdir(directory)).filter((name) =>
      /\.(?:mjs|js|d\.mts|d\.ts)$/.test(name),
    );
    const code = (
      await Promise.all(
        files.map((name) => readFile(new URL(name, directory), "utf8")),
      )
    ).join("\n");
    assert.doesNotMatch(
      code,
      /(?:from\s*|import\s*\(|require\s*\()["']@scure\/btc-signer/,
      "Published output must bundle the signer for both module formats",
    );

    assert.doesNotMatch(
      code,
      /@ckb-ccc\/btc-psbt/,
      "Published code and declarations must inline the private PSBT helper",
    );

    const entry = new URL(
      format === "esm" ? "index.mjs" : "index.js",
      directory,
    );
    const api =
      format === "esm"
        ? await import(entry)
        : createRequire(import.meta.url)(fileURLToPath(entry));
    const tx = transaction();
    const request = hex(tx);
    tx.signIdx(key, 0);
    const signer = createSigner(api, () => hex(tx));
    const signed = await signer.signPsbt(request, {
      inputsToSign: [{ index: 0, address: payment.address }],
    });
    assert.ok(
      btc.Transaction.fromPSBT(ccc.bytesFrom(signed)).getInput(0)
        .finalScriptWitness,
    );
  }
});
