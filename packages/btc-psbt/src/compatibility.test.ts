import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import { RawPSBTV0, RawPSBTV2 } from "@scure/btc-signer/psbt.js";
import { describe, expect, it } from "vitest";
import { PSBT_OPTIONS, WalletPsbt } from "./index.js";

// Only fixture construction bypasses scure's checks. Every tested production
// operation uses the encapsulated wallet boundary with stock scure.
const FIXTURE_OPTIONS = { ...PSBT_OPTIONS, disableScriptCheck: true };
const KEY = new Uint8Array(32).fill(1);
const OTHER = new Uint8Array(32).fill(2);
const PUB = secp256k1.getPublicKey(KEY);
const XPUB = schnorr.getPublicKey(KEY);
const PAY = btc.p2wpkh(PUB);
const TREE = btc.p2tr(XPUB, {
  script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
});
type Input = ReturnType<btc.Transaction["getInput"]>;
type Raw = ReturnType<typeof RawPSBTV0.decode>;
type Vector = { name: string; bytes: Uint8Array; accepted: boolean };

function fixture(
  version: number,
  script: Uint8Array = PAY.script,
  fields: Partial<Input> = {},
) {
  const tx = new btc.Transaction({ ...FIXTURE_OPTIONS, PSBTVersion: version });
  tx.addInput({
    txid: new Uint8Array(32).fill(1),
    index: 0,
    witnessUtxo: { amount: 10000n, script },
    ...fields,
  });
  tx.addOutput({ script: PAY.script, amount: 9000n });
  return tx;
}
function mutate(
  bytes: Uint8Array,
  version: number,
  change: (raw: Raw) => void,
) {
  const coder = version === 2 ? RawPSBTV2 : RawPSBTV0;
  const raw = coder.decode(Uint8Array.from(bytes));
  change(raw);
  return coder.encode(raw);
}
function legacyFixture(version: number) {
  const previous = new btc.Transaction(FIXTURE_OPTIONS);
  previous.addInput({ txid: new Uint8Array(32).fill(3), index: 0 });
  previous.addOutput({ script: btc.p2pk(PUB).script, amount: 10000n });
  const tx = new btc.Transaction({ ...FIXTURE_OPTIONS, PSBTVersion: version });
  tx.addInput({
    txid: previous.id,
    index: 0,
    nonWitnessUtxo: previous.toBytes(true, true),
  });
  tx.addOutput({ script: PAY.script, amount: 9000n });
  return tx;
}

// Acceptance contracts were compared against the original parser patch. Keep
// explicit expectations so this suite needs neither a patched oracle nor internals.
function vectors(version: number): Vector[] {
  const result: Vector[] = [];
  const scripts: [string, Uint8Array, Partial<Input>][] = [
    ["wpkh", PAY.script, {}],
    ["bare pk", btc.p2pk(PUB).script, {}],
    ["bare ms", btc.p2ms(1, [PUB]).script, {}],
    ["unknown root", TREE.script, { tapInternalKey: TREE.tapInternalKey }],
    [
      "tree",
      TREE.script,
      {
        tapInternalKey: TREE.tapInternalKey,
        tapMerkleRoot: TREE.tapMerkleRoot,
        tapLeafScript: TREE.tapLeafScript,
      },
    ],
  ];
  for (const [name, script, fields] of scripts) {
    const bytes = fixture(version, script, fields).toPSBT();
    result.push({ name, bytes, accepted: true });
    const updates: [string, Partial<Input>, boolean][] = [
      ["empty redeem", { redeemScript: new Uint8Array() }, false],
      ["empty witness", { witnessScript: new Uint8Array() }, false],
      ["redeem", { redeemScript: PAY.script }, false],
      ["witness", { witnessScript: PAY.script }, false],
      [
        "internal key",
        { tapInternalKey: schnorr.getPublicKey(OTHER) },
        name === "unknown root",
      ],
      ["root", { tapMerkleRoot: new Uint8Array(32).fill(7) }, false],
      [
        "leaves",
        { tapLeafScript: TREE.tapLeafScript },
        name === "tree" || name === "unknown root",
      ],
    ];
    for (const [field, update, accepted] of updates) {
      result.push({
        name: `${name} with ${field}`,
        bytes: mutate(bytes, version, (raw) =>
          Object.assign(raw.inputs[0], update),
        ),
        accepted,
      });
    }
  }
  for (const spend of [
    btc.p2sh(PAY),
    btc.p2wsh(btc.p2ms(1, [PUB])),
    btc.p2sh(btc.p2wsh(btc.p2ms(1, [PUB]))),
  ]) {
    const fields: Partial<Input> = {};
    if ("redeemScript" in spend) {
      fields.redeemScript = spend.redeemScript;
    }
    if ("witnessScript" in spend) {
      fields.witnessScript = spend.witnessScript;
    }
    const bytes = fixture(version, spend.script, fields).toPSBT();
    result.push({
      name: `valid ${spend.type} ${Object.keys(fields).join("/")}`,
      bytes,
      accepted: true,
    });
    for (const field of ["redeemScript", "witnessScript"] as const) {
      if (!fields[field]) {
        continue;
      }
      result.push({
        name: `${spend.type} wrong ${field}`,
        bytes: mutate(bytes, version, (raw) => {
          raw.inputs[0][field]![0] ^= 1;
        }),
        accepted: false,
      });
    }
  }
  const full = fixture(version, TREE.script, {
    tapInternalKey: TREE.tapInternalKey,
    tapMerkleRoot: TREE.tapMerkleRoot,
    tapLeafScript: TREE.tapLeafScript,
  }).toPSBT();
  for (const field of ["root", "parity", "internal", "leaf"] as const) {
    result.push({
      name: `wrong Taproot ${field}`,
      bytes: mutate(full, version, (raw) => {
        const input = raw.inputs[0];
        if (field === "root") {
          input.tapMerkleRoot![0] ^= 1;
        }
        if (field === "parity") {
          input.tapLeafScript![0][0].version ^= 1;
        }
        if (field === "internal") {
          input.tapInternalKey = schnorr.getPublicKey(OTHER);
        }
        if (field === "leaf") {
          input.tapLeafScript![0][1][1] ^= 1;
        }
      }),
      accepted: false,
    });
  }
  const unknown = fixture(version, TREE.script, {
    tapInternalKey: TREE.tapInternalKey,
  }).toPSBT();
  result.push({
    name: "noncanonical Taproot program",
    bytes: mutate(unknown, version, (raw) => {
      raw.inputs[0].witnessUtxo!.script = Uint8Array.from([
        0x51,
        0x4c,
        0x20,
        ...TREE.script.subarray(2),
      ]);
    }),
    accepted: false,
  });
  const mixed = fixture(version, btc.p2pk(PUB).script);
  mixed.addInput({
    txid: new Uint8Array(32).fill(2),
    index: 0,
    witnessUtxo: { amount: 10000n, script: PAY.script },
  });
  result.push({
    name: "unrelated input with invalid wrapper",
    bytes: mutate(mixed.toPSBT(), version, (raw) => {
      raw.inputs[1].redeemScript = PAY.script;
    }),
    accepted: false,
  });
  const legacy = legacyFixture(version).toPSBT();
  result.push({ name: "bare nonWitnessUtxo", bytes: legacy, accepted: true });
  result.push({
    name: "bare wrong txid",
    bytes: mutate(legacy, version, (raw) => {
      (version === 0
        ? raw.global.unsignedTx!.inputs[0]
        : raw.inputs[0]
      ).txid![0] ^= 1;
    }),
    accepted: false,
  });
  result.push({
    name: "bare wrong amount",
    bytes: mutate(legacy, version, (raw) => {
      raw.inputs[0].witnessUtxo = { amount: 1n, script: btc.p2pk(PUB).script };
    }),
    accepted: false,
  });
  result.push({
    name: "bare out-of-range prevout",
    bytes: mutate(legacy, version, (raw) => {
      (version === 0 ? raw.global.unsignedTx!.inputs[0] : raw.inputs[0]).index =
        1;
    }),
    accepted: false,
  });
  result.push({
    name: "nonminimal bare P2PK push",
    bytes: fixture(
      version,
      Uint8Array.from([0x4c, 0x21, ...PUB, 0xac]),
    ).toPSBT(),
    accepted: true,
  });
  result.push({
    name: "unknown script passthrough",
    bytes: fixture(version, new Uint8Array([0x6a])).toPSBT(),
    accepted: true,
  });
  result.push({
    name: "root without internal key",
    bytes: fixture(version, TREE.script, {
      tapMerkleRoot: TREE.tapMerkleRoot,
    }).toPSBT(),
    accepted: true,
  });
  result.push({
    name: "leaves without root or separate internal key",
    bytes: fixture(version, TREE.script, {
      tapLeafScript: TREE.tapLeafScript,
    }).toPSBT(),
    accepted: true,
  });
  const missing = new btc.Transaction({
    ...FIXTURE_OPTIONS,
    PSBTVersion: version,
  });
  missing.addInput({ txid: new Uint8Array(32).fill(4), index: 0 });
  missing.addOutput({ script: PAY.script, amount: 9000n });
  result.push({
    name: "missing unrelated prevout",
    bytes: missing.toPSBT(),
    accepted: true,
  });
  return result;
}

describe.each([0, 2])("stock-scure compatibility v%i", (version) => {
  it.each(vectors(version))(
    "$name (accepted=$accepted)",
    ({ bytes, accepted }) => {
      if (!accepted) {
        expect(() => WalletPsbt.fromPSBT(bytes)).toThrow();
        return;
      }
      const tx = WalletPsbt.fromPSBT(bytes);
      expect(tx.toPSBT()).toEqual(bytes);
    },
  );

  it("finalizes a bare input and preserves its PSBT version", () => {
    const source = legacyFixture(version);
    source.signIdx(KEY, 0);
    const tx = WalletPsbt.fromPSBT(source.toPSBT());
    tx.finalizeInput(0);
    expect(tx.isFinal).toBe(true);
    expect(tx.getInput(0).finalScriptSig?.length).toBeGreaterThan(0);
    expect(
      (version === 2 ? RawPSBTV2 : RawPSBTV0).decode(tx.toPSBT()).global
        .version ?? 0,
    ).toBe(version);
  });

  it("closes the unrelated-input mutation/serialization bypass", () => {
    const source = fixture(version, btc.p2pk(PUB).script);
    source.addInput({
      txid: new Uint8Array(32).fill(2),
      index: 0,
      witnessUtxo: { amount: 10000n, script: PAY.script },
    });
    // An exception at input 0 must not disable checks on ordinary input 1.
    const unchecked = btc.Transaction.fromPSBT(
      source.toPSBT(),
      FIXTURE_OPTIONS,
    );
    unchecked.updateInput(1, { redeemScript: PAY.script });
    expect(() => unchecked.toPSBT()).not.toThrow();
    expect(() => WalletPsbt.fromPSBT(unchecked.toPSBT())).toThrow(
      /redeemScript/,
    );

    source.signIdx(KEY, 1);
    const bytes = source.toPSBT();
    const tx = WalletPsbt.fromPSBT(bytes);
    expect("updateInput" in tx).toBe(false);
    expect("addInput" in tx).toBe(false);
    expect("updateOutput" in tx).toBe(false);
    expect("clone" in tx).toBe(false);
    expect(Reflect.ownKeys(tx)).toHaveLength(0);
    const unrelated = tx.getInput(1);
    unrelated.redeemScript = PAY.script;
    unrelated.witnessUtxo!.script[0] ^= 1;
    bytes.fill(0); // Input byte storage must be owned too.
    expect(tx.getInput(1).redeemScript).toBeUndefined();
    tx.finalizeInput(1);
    const result = WalletPsbt.fromPSBT(tx.toPSBT());
    expect(result.getInput(0).witnessUtxo?.script).toEqual(
      btc.p2pk(PUB).script,
    );
    expect(result.getInput(0).finalScriptSig).toBeUndefined();
    expect(result.getInput(1).finalScriptWitness).toHaveLength(2);
  });

  it.each(["length", "point"])(
    "rejects malformed omitted-root internal-key %s",
    (kind) => {
      const bytes = fixture(version, TREE.script, {
        tapInternalKey: TREE.tapInternalKey,
      }).toPSBT();
      const position = bytes.findIndex((_, i) =>
        XPUB.every((byte, j) => bytes[i + j] === byte),
      );
      expect(position).toBeGreaterThan(0);
      if (kind === "length") {
        bytes[position - 1] = 31;
      } else {
        bytes.fill(0, position, position + 32);
      }
      expect(() => WalletPsbt.fromPSBT(bytes)).toThrow();
    },
  );

  it("leaves state intact when finalization rejects signature policy", () => {
    const source = fixture(version);
    source.signIdx(KEY, 0);
    const bytes = mutate(source.toPSBT(), version, (raw) => {
      raw.inputs[0].sighashType = 2;
    });
    const tx = WalletPsbt.fromPSBT(bytes);
    expect(() => tx.finalizeInput(0)).toThrow(/sighash/);
    expect(tx.toPSBT()).toEqual(bytes);
  });
});
