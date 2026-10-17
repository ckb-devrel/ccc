import assert from "node:assert/strict";
import { readFile, readdir, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const xrequire = createRequire(
  await realpath(new URL("packages/xverse/package.json", root)),
);
const jrequire = createRequire(
  await realpath(new URL("packages/joy-id/package.json", root)),
);
const fixtureRequire = createRequire(xrequire.resolve("@scure/btc-signer"));
const btc = await import(pathToFileURL(xrequire.resolve("@scure/btc-signer")));
const { RawPSBTV0, RawPSBTV2 } = await import(
  pathToFileURL(xrequire.resolve("@scure/btc-signer/psbt.js"))
);
const { getInputType } = await import(
  pathToFileURL(xrequire.resolve("@scure/btc-signer/transaction.js"))
);
const { ccc } = xrequire("@ckb-ccc/core");
const { schnorr, secp256k1 } = await import(
  pathToFileURL(fixtureRequire.resolve("@noble/curves/secp256k1.js"))
);
const { DappRequestType } = jrequire("@joyid/common");
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
  disableScriptCheck: true,
};
const hex = (tx) => ccc.hexFrom(tx.toPSBT());
const rawChange = (psbt, change, version = 0) => {
  const coder = version === 2 ? RawPSBTV2 : RawPSBTV0;
  const raw = coder.decode(ccc.bytesFrom(psbt));
  change(raw);
  return ccc.hexFrom(coder.encode(raw));
};
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
const singleKeyPayments = [
  ["wpkh", btc.p2wpkh(pub)],
  ["sh-wpkh", btc.p2sh(btc.p2wpkh(pub))],
  ["pkh", btc.p2pkh(pub)],
  ["sh-pkh", btc.p2sh(btc.p2pkh(pub))],
  ["wsh-pkh", btc.p2wsh(btc.p2pkh(pub))],
  ["sh-wsh-pkh", btc.p2sh(btc.p2wsh(btc.p2pkh(pub)))],
  ["pk", btc.p2pk(pub)],
  ["sh-pk", btc.p2sh(btc.p2pk(pub))],
  ["wsh-pk", btc.p2wsh(btc.p2pk(pub))],
  ["sh-wsh-pk", btc.p2sh(btc.p2wsh(btc.p2pk(pub)))],
];
function singleKeyTransaction(spend) {
  const previous = new btc.Transaction(options);
  previous.addInput({ txid: new Uint8Array(32).fill(7), index: 0 });
  previous.addOutput({ script: spend.script, amount: 10000n });
  const tx = new btc.Transaction(options);
  tx.addInput({
    txid: previous.id,
    index: 0,
    nonWitnessUtxo: previous.toBytes(true, true),
    ...(spend.redeemScript ? { redeemScript: spend.redeemScript } : {}),
    ...(spend.witnessScript ? { witnessScript: spend.witnessScript } : {}),
  });
  tx.addOutput({ script: payment.script, amount: 9000n });
  return tx;
}
function createSigner(wallet, api, response) {
  if (wallet === "xverse") {
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
  globalThis.location = { href: "https://dapp.test/" };
  const popup = {
    location: {},
    closed: false,
    close() {
      this.closed = true;
    },
  };
  globalThis.window = {
    screenX: 0,
    screenY: 0,
    innerWidth: 1200,
    innerHeight: 800,
    open: () => popup,
    navigator: {},
    matchMedia: () => ({ matches: false }),
    removeEventListener: () => {},
    addEventListener: (_name, listener) =>
      queueMicrotask(() =>
        listener({
          origin: "https://testnet.joyid.dev",
          data: {
            type: DappRequestType.SignPsbt,
            data: { tx: response().slice(2) },
          },
        }),
      ),
  };
  return new api.JoyId.BitcoinSigner(
    client,
    "Test",
    "",
    undefined,
    "p2wpkh",
    undefined,
    {
      get: async () => ({
        address: payment.address,
        publicKey: ccc.hexFrom(pub),
        keyType: "main_key",
      }),
      set: async () => {},
    },
    "btcTestnet",
  );
}
let passed = 0;
const selection = [{ index: 0, address: payment.address }];
try {
  for (const wallet of ["xverse", "joy-id"]) {
    const manifest = JSON.parse(
      await readFile(new URL(`packages/${wallet}/package.json`, root), "utf8"),
    );
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      assert.equal(manifest[field]?.["@ckb-ccc/btc-psbt"], undefined);
      passed++;
    }
    for (const format of ["esm", "cjs"]) {
      const directory = new URL(
        `packages/${wallet}/${format === "esm" ? "dist" : "dist.commonjs"}/`,
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
      passed++;
      assert.doesNotMatch(
        code,
        /@ckb-ccc\/btc-psbt/,
        "Published code and declarations must inline the private PSBT helper",
      );
      passed++;
      const entry = new URL(
        format === "esm" ? "index.mjs" : "index.js",
        directory,
      );
      const api =
        format === "esm"
          ? await import(entry)
          : createRequire(import.meta.url)(fileURLToPath(entry));
      for (const [type, spend] of singleKeyPayments) {
        const candidate = singleKeyTransaction(spend);
        const request = hex(candidate);
        const inputType = getInputType(candidate.getInput(0));
        const scriptCode =
          inputType.last.type === "wpkh"
            ? btc.p2pkh(pub).script
            : inputType.lastScript;
        const digest =
          inputType.txType === "segwit"
            ? candidate.preimageWitnessV0(0, scriptCode, 1, 10000n)
            : candidate.preimageLegacy(0, scriptCode, 1);
        const unrelatedKey = new Uint8Array(32).fill(2);
        const unrelatedPub = secp256k1.getPublicKey(unrelatedKey, true);
        const der = secp256k1.sign(digest, unrelatedKey, {
          format: "der",
          prehash: false,
        });
        assert.ok(
          secp256k1.verify(der, digest, unrelatedPub, {
            format: "der",
            prehash: false,
          }),
        );
        const wrongKey = rawChange(request, (raw) => {
          raw.inputs[0].partialSig = [
            [unrelatedPub, ccc.bytesConcat(der, [1])],
          ];
        });
        const wrongSigner = createSigner(wallet, api, () => wrongKey);
        await assert.rejects(
          wrongSigner.signPsbt(request, { inputsToSign: selection }),
          (error) =>
            error.cause instanceof Error &&
            /public key.*script/.test(error.cause.message),
          `${wallet} ${format} ${type}: reject a signature key outside the committed script`,
        );
        passed++;
        const partial = await wrongSigner.signPsbt(request, {
          inputsToSign: selection,
          autoFinalized: false,
        });
        assert.ok(
          btc.Transaction.fromPSBT(ccc.bytesFrom(partial), options).getInput(0)
            .partialSig,
        );
        passed++;
        candidate.signIdx(key, 0);
        const goodSigner = createSigner(wallet, api, () => hex(candidate));
        const result = await goodSigner.signPsbt(request, {
          inputsToSign: selection,
        });
        assert.ok(
          btc.Transaction.fromPSBT(ccc.bytesFrom(result), options).isFinal,
        );
        passed++;
      }
      const tx = transaction();
      tx.addInput({
        txid: new Uint8Array(32).fill(2),
        index: 0,
        witnessUtxo: { amount: 10000n, script: btc.p2pk(pub).script },
      });
      const request = hex(tx);
      tx.signIdx(key, 0);
      let response = hex(tx);
      let signer = createSigner(wallet, api, () => response);
      const result = btc.Transaction.fromPSBT(
        ccc.bytesFrom(
          await signer.signPsbt(request, { inputsToSign: selection }),
        ),
        options,
      );
      assert.ok(result.getInput(0).finalScriptWitness);
      assert.equal(result.getInput(1).finalScriptWitness, undefined);
      passed++;
      // A bare input must not suppress commitment checks on another input.
      const invalidWrapper = rawChange(request, (raw) => {
        raw.inputs[0].redeemScript = payment.script;
      });
      for (const autoFinalized of [false, true]) {
        signer = createSigner(wallet, api, () => invalidWrapper);
        await assert.rejects(
          signer.signPsbt(invalidWrapper, {
            autoFinalized,
            inputsToSign: selection,
          }),
          /redeemScript/,
        );
        passed++;
      }
      const declared = transaction();
      declared.updateInput(0, { sighashType: 1 });
      const wrong = transaction();
      wrong.updateInput(0, { sighashType: 2 });
      wrong.signIdx(key, 0, [2]);
      response = rawChange(hex(wrong), (raw) => {
        delete raw.inputs[0].sighashType;
      });
      for (const autoFinalized of [false, true]) {
        signer = createSigner(wallet, api, () => response);
        await assert.rejects(
          signer.signPsbt(hex(declared), {
            autoFinalized,
            inputsToSign: selection,
          }),
          /sighash/i,
        );
        passed++;
      }
      const locked = new btc.Transaction({ ...options, PSBTVersion: 2 });
      for (let index = 0; index < 2; index++) {
        locked.addInput({
          txid: new Uint8Array(32).fill(index + 1),
          index: 0,
          sequence: 0xfffffffe,
          requiredTimeLocktime: 500000100,
          witnessUtxo: { amount: 10000n, script: payment.script },
        });
      }
      locked.updateInput(0, { requiredHeightLocktime: 100 });
      locked.addOutput({ script: payment.script, amount: 9000n });
      const locktimeRaw = RawPSBTV2.decode(locked.toPSBT());
      delete locktimeRaw.inputs[0].requiredHeightLocktime;
      locktimeRaw.inputs[1].requiredHeightLocktime = 99;
      response = ccc.hexFrom(RawPSBTV2.encode(locktimeRaw));
      for (const autoFinalized of [false, true]) {
        signer = createSigner(wallet, api, () => response);
        await assert.rejects(
          signer.signPsbt(hex(locked), {
            autoFinalized,
            inputsToSign: selection,
          }),
          /different transaction/,
        );
        passed++;
      }
      const presigned = transaction();
      presigned.signIdx(key, 0);
      response = rawChange(hex(presigned), (raw) => {
        delete raw.inputs[0].partialSig;
      });
      for (const autoFinalized of [false, true]) {
        signer = createSigner(wallet, api, () => response);
        await assert.rejects(
          signer.signPsbt(hex(presigned), {
            autoFinalized,
            inputsToSign: selection,
          }),
          /removed an existing signature/,
        );
        passed++;
      }
      presigned.finalizeIdx(0);
      response = rawChange(hex(presigned), (raw) => {
        raw.inputs[0].finalScriptSig = new Uint8Array();
      });
      signer = createSigner(wallet, api, () => response);
      const preserved = btc.Transaction.fromPSBT(
        ccc.bytesFrom(
          await signer.signPsbt(response, { inputsToSign: selection }),
        ),
        options,
      );
      assert.deepEqual(
        preserved.getInput(0).finalScriptWitness,
        presigned.getInput(0).finalScriptWitness,
      );
      passed++;
      const tree = btc.p2tr(schnorr.getPublicKey(key), {
        script: btc.p2tr_pk(schnorr.getPublicKey(new Uint8Array(32).fill(2)))
          .script,
      });
      const tap = transaction(tree.script);
      tap.updateInput(0, {
        tapInternalKey: tree.tapInternalKey,
        tapMerkleRoot: tree.tapMerkleRoot,
        tapLeafScript: tree.tapLeafScript,
      });
      const strip = (value) =>
        rawChange(value, (raw) => {
          delete raw.inputs[0].tapMerkleRoot;
          delete raw.inputs[0].tapLeafScript;
        });
      const incomplete = strip(hex(tap));
      tap.signIdx(key, 0);
      response = strip(hex(tap));
      signer = createSigner(wallet, api, () => response);
      const finalized = btc.Transaction.fromPSBT(
        ccc.bytesFrom(
          await signer.signPsbt(incomplete, { inputsToSign: selection }),
        ),
        options,
      );
      assert.equal(finalized.getInput(0).finalScriptWitness?.length, 1);
      passed++;
      // Scure's private-key signer assumes an empty tree when the root is absent.
      // Adapters never call it, and must reject such a wallet response themselves.
      const emptyTree = btc.Transaction.fromPSBT(
        ccc.bytesFrom(incomplete),
        options,
      );
      emptyTree.signIdx(key, 0);
      response = hex(emptyTree);
      for (const autoFinalized of [false, true]) {
        signer = createSigner(wallet, api, () => response);
        await assert.rejects(
          signer.signPsbt(incomplete, {
            autoFinalized,
            inputsToSign: selection,
          }),
          /Invalid Taproot key-path signature/,
        );
        passed++;
      }
      for (const version of [0, 2]) {
        for (const mode of [3, 0x83]) {
          const nonzero = new btc.Transaction({
            ...options,
            PSBTVersion: version,
          });
          for (let index = 0; index < 2; index++) {
            nonzero.addInput({
              txid: new Uint8Array(32).fill(index + 1),
              index: 0,
              witnessUtxo: { amount: 10000n, script: tree.script },
              tapInternalKey: tree.tapInternalKey,
              tapMerkleRoot: tree.tapMerkleRoot,
              tapLeafScript: tree.tapLeafScript,
            });
            nonzero.addOutput({ amount: 9000n, script: payment.script });
          }
          nonzero.updateInput(1, { sighashType: mode });
          const omitTree = (value) =>
            rawChange(
              value,
              (raw) => {
                for (const input of raw.inputs) {
                  delete input.tapMerkleRoot;
                  delete input.tapLeafScript;
                }
              },
              version,
            );
          const nonzeroRequest = omitTree(hex(nonzero));
          nonzero.signIdx(key, 1, [mode]);
          response = omitTree(hex(nonzero));
          for (const autoFinalized of [false, true]) {
            signer = createSigner(wallet, api, () => response);
            const returned = btc.Transaction.fromPSBT(
              ccc.bytesFrom(
                await signer.signPsbt(nonzeroRequest, {
                  autoFinalized,
                  inputsToSign: [
                    { ...selection[0], index: 1, sighashTypes: [mode] },
                  ],
                }),
              ),
              options,
            );
            assert.equal(returned.getInput(0).finalScriptWitness, undefined);
            assert.ok(
              autoFinalized
                ? returned.getInput(1).finalScriptWitness
                : returned.getInput(1).tapKeySig,
            );
            passed++;
          }
        }
      }
      console.log(
        `${wallet} ${format}: bundled PSBT boundary, transaction binding, signature preservation/policy, finalization, and optional-tree signing flow passed`,
      );
    }
  }
  console.log(`${passed} artifact assertions passed`);
} finally {
  delete globalThis.window;
  delete globalThis.location;
}
