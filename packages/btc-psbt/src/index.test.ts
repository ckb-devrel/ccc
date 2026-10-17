import { ccc } from "@ckb-ccc/core";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import { RawPSBTV0, RawPSBTV2 } from "@scure/btc-signer/psbt.js";
import { getInputType } from "@scure/btc-signer/transaction.js";
import { sha256x2 } from "@scure/btc-signer/utils.js";
import { describe, expect, it } from "vitest";
import {
  PSBT_OPTIONS,
  WalletPsbt,
  parseAndValidateSignedPsbt,
  validateInputSelection,
  verifyFinalizerPubkey,
  verifyTaprootKeySignature,
} from "./index.js";

// Test-only builders model wallet PSBTs that stock scure refuses to construct.
// Production parsing/finalization always goes through WalletPsbt.
const FIXTURE_OPTIONS = { ...PSBT_OPTIONS, disableScriptCheck: true };

const KEY = new Uint8Array(32).fill(1);
const OTHER = new Uint8Array(32).fill(2);
const PUB = secp256k1.getPublicKey(KEY, true);
const OTHER_PUB = secp256k1.getPublicKey(OTHER, true);
const PAY = btc.p2wpkh(PUB);
const MODES = [1, 2, 3, 0x81, 0x82, 0x83];
type Raw = ReturnType<typeof RawPSBTV0.decode>;

function hex(tx: Pick<btc.Transaction, "toPSBT">) {
  return ccc.hexFrom(tx.toPSBT());
}
function txFor(script = PAY.script, count = 1, version = 0) {
  const tx = new btc.Transaction({ ...FIXTURE_OPTIONS, PSBTVersion: version });
  for (let i = 0; i < count; i++) {
    tx.addInput({
      txid: new Uint8Array(32).fill(i + 1),
      index: 0,
      witnessUtxo: { amount: 10000n, script },
    });
    tx.addOutput({ script: PAY.script, amount: 9000n });
  }
  return tx;
}
function mutate(
  psbt: ccc.Hex,
  change: (raw: Raw) => void,
  version = 0,
): ccc.Hex {
  const coder = version === 2 ? RawPSBTV2 : RawPSBTV0;
  const raw = coder.decode(ccc.bytesFrom(psbt));
  change(raw);
  return ccc.hexFrom(coder.encode(raw));
}
function policy(mode: number, index = 0) {
  return [
    ccc.InputToSign.from({ index, publicKey: PUB, sighashTypes: [mode] }),
  ];
}
function signEcdsa(tx: btc.Transaction, mode = 1, index = 0) {
  tx.updateInput(index, { sighashType: mode });
  tx.signIdx(KEY, index, [mode]);
  return hex(tx);
}
function signedTaproot(mode = 0, count = 1, index = 0) {
  const payment = btc.p2tr(schnorr.getPublicKey(KEY));
  const tx = txFor(payment.script, count);
  for (let i = 0; i < count; i++) {
    tx.updateInput(i, { tapInternalKey: payment.tapInternalKey });
  }
  tx.updateInput(index, { sighashType: mode });
  const before = hex(tx);
  tx.signIdx(KEY, index, [mode]);
  return { before, after: hex(tx), tx };
}

const SINGLE_KEY_PAYMENTS = [
  ["wpkh", btc.p2wpkh(PUB)],
  ["sh-wpkh", btc.p2sh(btc.p2wpkh(PUB))],
  ["pkh", btc.p2pkh(PUB)],
  ["sh-pkh", btc.p2sh(btc.p2pkh(PUB))],
  ["wsh-pkh", btc.p2wsh(btc.p2pkh(PUB))],
  ["sh-wsh-pkh", btc.p2sh(btc.p2wsh(btc.p2pkh(PUB)))],
  ["pk", btc.p2pk(PUB)],
  ["sh-pk", btc.p2sh(btc.p2pk(PUB))],
  ["wsh-pk", btc.p2wsh(btc.p2pk(PUB))],
  ["sh-wsh-pk", btc.p2sh(btc.p2wsh(btc.p2pk(PUB)))],
] as const;

function singleKeyTx(payment: {
  script: Uint8Array;
  redeemScript?: Uint8Array;
  witnessScript?: Uint8Array;
}) {
  const previous = new btc.Transaction(FIXTURE_OPTIONS);
  previous.addInput({ txid: new Uint8Array(32).fill(7), index: 0 });
  previous.addOutput({ script: payment.script, amount: 10000n });
  const tx = new btc.Transaction(FIXTURE_OPTIONS);
  tx.addInput({
    txid: previous.id,
    index: 0,
    nonWitnessUtxo: previous.toBytes(true, true),
    ...(payment.redeemScript ? { redeemScript: payment.redeemScript } : {}),
    ...(payment.witnessScript ? { witnessScript: payment.witnessScript } : {}),
  });
  tx.addOutput({ script: PAY.script, amount: 9000n });
  return tx;
}

// These fixtures have one input and use SIGHASH_ALL. Keep their legacy digest
// construction on public coders rather than scure's private signing helpers.
function legacySighashAll(tx: btc.Transaction, scriptCode: Uint8Array) {
  expect(tx.inputsLength).toBe(1);
  const raw = btc.RawTx.decode(tx.unsignedTx);
  raw.inputs[0].finalScriptSig = scriptCode;
  return sha256x2(btc.RawTx.encode(raw), new Uint8Array([1, 0, 0, 0]));
}

describe("wallet PSBT response validation", () => {
  it.each(SINGLE_KEY_PAYMENTS)(
    "binds the finalizer public key to the %s script",
    (_name, payment) => {
      const tx = singleKeyTx(payment);
      const inputType = getInputType(tx.getInput(0));
      const scriptCode =
        inputType.last.type === "wpkh"
          ? btc.p2pkh(PUB).script
          : inputType.lastScript;
      const digest =
        inputType.txType === "segwit"
          ? tx.preimageWitnessV0(0, scriptCode, 1, 10000n)
          : legacySighashAll(tx, scriptCode);
      const signature = secp256k1.sign(digest, OTHER, {
        format: "der",
        prehash: false,
      });
      expect(
        secp256k1.verify(signature, digest, OTHER_PUB, {
          format: "der",
          prehash: false,
        }),
      ).toBe(true);
      tx.updateInput(0, {
        partialSig: [[OTHER_PUB, ccc.bytesConcat(signature, [1])]],
      });
      const before = hex(tx);
      const guarded = WalletPsbt.fromPSBT(tx.toPSBT());
      expect(() => guarded.finalizeInput(0)).toThrow(/public key.*script/);
      expect(hex(guarded)).toBe(before);

      const correct = singleKeyTx(payment);
      correct.signIdx(KEY, 0);
      expect(
        secp256k1.verify(
          correct.getInput(0).partialSig![0][1].subarray(0, -1),
          digest,
          PUB,
          { format: "der", prehash: false },
        ),
      ).toBe(true);
      expect(() => verifyFinalizerPubkey(correct, 0)).not.toThrow();
      const finalized = WalletPsbt.fromPSBT(correct.toPSBT());
      finalized.finalizeInput(0);
      expect(finalized.isFinal).toBe(true);
    },
  );
  it("accepts equivalent compressed and uncompressed public keys for P2PK", () => {
    const tx = singleKeyTx(btc.p2pk(secp256k1.getPublicKey(KEY, false)));
    const digest = legacySighashAll(
      tx,
      getInputType(tx.getInput(0)).lastScript,
    );
    const signature = secp256k1.sign(digest, KEY, {
      format: "der",
      prehash: false,
    });
    tx.updateInput(0, { partialSig: [[PUB, ccc.bytesConcat(signature, [1])]] });
    expect(() => verifyFinalizerPubkey(tx, 0)).not.toThrow();
    const finalized = WalletPsbt.fromPSBT(tx.toPSBT());
    finalized.finalizeInput(0);
    expect(finalized.isFinal).toBe(true);
  });
  it.each(MODES)("accepts explicit ECDSA sighash %i", (mode) => {
    const tx = txFor();
    tx.updateInput(0, { sighashType: mode });
    const before = hex(tx);
    const { signed } = parseAndValidateSignedPsbt(
      before,
      signEcdsa(tx, mode),
      policy(mode),
    );
    signed.finalizeInput(0);
    expect(signed.getInput(0).finalScriptWitness).toBeDefined();
  });
  it.each([0, ...MODES])("accepts explicit Schnorr sighash %i", (mode) => {
    const { before, after } = signedTaproot(mode);
    expect(
      parseAndValidateSignedPsbt(before, after, policy(mode)).signed.getInput(0)
        .tapKeySig,
    ).toBeDefined();
  });
  it.each([0, ...MODES])(
    "accepts explicit Taproot script-path sighash %i",
    (mode) => {
      const payment = btc.p2tr(schnorr.getPublicKey(KEY), {
        script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
      });
      const tx = txFor(payment.script);
      tx.updateInput(0, {
        tapInternalKey: payment.tapInternalKey,
        tapMerkleRoot: payment.tapMerkleRoot,
        tapLeafScript: payment.tapLeafScript,
        sighashType: mode,
      });
      const before = hex(tx);
      tx.signIdx(OTHER, 0, [mode]);
      const after = hex(tx);
      expect(
        parseAndValidateSignedPsbt(before, after, policy(mode)).signed.getInput(
          0,
        ).tapScriptSig,
      ).toHaveLength(1);
      expect(() =>
        parseAndValidateSignedPsbt(before, after, policy(mode === 1 ? 2 : 1)),
      ).toThrow(/disallowed/);
    },
  );
  it.each(["keep", "delete", "rewrite"])(
    "rejects actual signature mode despite a %s declaration",
    (action) => {
      const request = txFor();
      request.updateInput(0, { sighashType: 1 });
      const response = signEcdsa(txFor(), 2);
      const after = mutate(response, (raw) => {
        if (action === "delete") {
          delete raw.inputs[0].sighashType;
        } else {
          raw.inputs[0].sighashType = action === "keep" ? 1 : 2;
        }
      });
      expect(() => parseAndValidateSignedPsbt(hex(request), after)).toThrow(
        /sighash/i,
      );
    },
  );
  it("restores an omitted declaration but still validates actual signature bytes", () => {
    const tx = txFor();
    tx.updateInput(0, { sighashType: 2 });
    const before = hex(tx);
    const after = mutate(signEcdsa(tx, 2), (raw) => {
      delete raw.inputs[0].sighashType;
    });
    expect(
      parseAndValidateSignedPsbt(before, after).signed.getInput(0).sighashType,
    ).toBe(2);
  });
  it("does not invent an ALL policy when no mode was declared", () => {
    const before = hex(txFor());
    const after = mutate(signEcdsa(txFor(), 2), (raw) => {
      delete raw.inputs[0].sighashType;
    });
    expect(
      parseAndValidateSignedPsbt(before, after).signed.getInput(0).partialSig,
    ).toHaveLength(1);
  });
  it("rejects caller-disallowed new and replaced signatures", () => {
    const before = hex(txFor());
    const after = signEcdsa(txFor(), 2);
    expect(() => parseAndValidateSignedPsbt(before, after, policy(1))).toThrow(
      /disallowed/,
    );
    const old = mutate(signEcdsa(txFor(), 1), (raw) => {
      delete raw.inputs[0].sighashType;
    });
    const replacement = mutate(after, (raw) => {
      delete raw.inputs[0].sighashType;
    });
    expect(() =>
      parseAndValidateSignedPsbt(old, replacement, policy(1)),
    ).toThrow(/disallowed/);
  });
  it("does not apply a caller allowlist to another participant's existing signature", () => {
    const payment = btc.p2wsh(btc.p2ms(2, [PUB, OTHER_PUB]));
    const tx = txFor(payment.script);
    tx.updateInput(0, { witnessScript: payment.witnessScript, sighashType: 2 });
    tx.signIdx(OTHER, 0, [2]);
    const before = mutate(hex(tx), (raw) => {
      delete raw.inputs[0].sighashType;
    });
    const response = btc.Transaction.fromPSBT(
      ccc.bytesFrom(before),
      FIXTURE_OPTIONS,
    );
    response.signIdx(KEY, 0, [1]);
    expect(
      parseAndValidateSignedPsbt(
        before,
        hex(response),
        policy(1),
      ).signed.getInput(0).partialSig,
    ).toHaveLength(2);
  });
  it.each(["partialSig", "tapKeySig", "tapScriptSig"] as const)(
    "rejects removal of an existing %s",
    (field) => {
      let before: ccc.Hex;
      if (field === "partialSig") {
        before = signEcdsa(txFor());
      } else if (field === "tapKeySig") {
        before = signedTaproot().after;
      } else {
        const payment = btc.p2tr(schnorr.getPublicKey(KEY), {
          script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
        });
        const tx = txFor(payment.script);
        tx.updateInput(0, {
          tapInternalKey: payment.tapInternalKey,
          tapMerkleRoot: payment.tapMerkleRoot,
          tapLeafScript: payment.tapLeafScript,
        });
        tx.signIdx(OTHER, 0);
        before = hex(tx);
      }
      const after = mutate(before, (raw) => {
        expect(raw.inputs[0][field]).toBeDefined();
        delete raw.inputs[0][field];
      });
      expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(
        /removed an existing signature/,
      );
    },
  );
  it("rejects a multisig response that drops another participant's signature", () => {
    const payment = btc.p2wsh(btc.p2ms(2, [PUB, OTHER_PUB]));
    const tx = txFor(payment.script);
    tx.updateInput(0, { witnessScript: payment.witnessScript });
    tx.signIdx(OTHER, 0);
    const before = hex(tx);
    tx.signIdx(KEY, 0);
    const after = mutate(hex(tx), (raw) => {
      const signatures = raw.inputs[0].partialSig!;
      const index = signatures.findIndex(
        ([pubkey]) => ccc.hexFrom(pubkey) === ccc.hexFrom(OTHER_PUB),
      );
      expect(index).toBeGreaterThanOrEqual(0);
      signatures.splice(index, 1);
    });
    expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(
      /removed an existing signature/,
    );
  });
  it.each(["version", "locktime", "outpoint", "sequence", "output", "order"])(
    "rejects changed transaction %s",
    (field) => {
      const before = hex(txFor(PAY.script, 2));
      const after = mutate(before, (raw) => {
        const tx = raw.global.unsignedTx!;
        if (field === "version") {
          tx.version++;
        }
        if (field === "locktime") {
          tx.lockTime++;
        }
        if (field === "outpoint") {
          tx.inputs[0].index++;
        }
        if (field === "sequence") {
          tx.inputs[0].sequence--;
        }
        if (field === "output") {
          tx.outputs[0].amount--;
        }
        if (field === "order") {
          tx.inputs[0].txid = new Uint8Array(32).fill(2);
          tx.inputs[1].txid = new Uint8Array(32).fill(1);
        }
      });
      expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(
        /different transaction/,
      );
    },
  );
  it("rejects PSBTv2 locktime changes caused by restored constraints", () => {
    const tx = txFor(PAY.script, 2, 2);
    for (let index = 0; index < 2; index++) {
      tx.updateInput(index, {
        sequence: 0xfffffffe,
        requiredTimeLocktime: 500000100,
      });
    }
    tx.updateInput(0, { requiredHeightLocktime: 100 });
    const before = hex(tx);
    const after = mutate(
      before,
      (raw) => {
        delete raw.inputs[0].requiredHeightLocktime;
        raw.inputs[1].requiredHeightLocktime = 99;
      },
      2,
    );
    const response = btc.Transaction.fromPSBT(
      ccc.bytesFrom(after),
      FIXTURE_OPTIONS,
    );
    expect(ccc.hexFrom(response.unsignedTx)).toBe(ccc.hexFrom(tx.unsignedTx));
    expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(
      /different transaction/,
    );
  });
  it.each(["amount", "script"])(
    "rejects changed previous output %s",
    (field) => {
      const before = hex(txFor());
      const after = mutate(before, (raw) => {
        if (field === "amount") {
          raw.inputs[0].witnessUtxo!.amount++;
        } else {
          raw.inputs[0].witnessUtxo!.script = btc.p2wpkh(OTHER_PUB).script;
        }
      });
      expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(
        /witnessUtxo/,
      );
    },
  );
  it("restores omitted UTXO data without restoring replaced signatures", () => {
    const tx = txFor();
    const before = hex(tx);
    const after = mutate(signEcdsa(tx), (raw) => {
      delete raw.inputs[0].witnessUtxo;
    });
    expect(
      parseAndValidateSignedPsbt(before, after).signed.getInput(0).witnessUtxo,
    ).toBeDefined();
  });
  it("rejects added final scripts and preserves unchanged finalized inputs", () => {
    const tx = txFor();
    const before = hex(tx);
    signEcdsa(tx);
    tx.finalizeIdx(0);
    expect(() => parseAndValidateSignedPsbt(before, hex(tx))).toThrow(
      /finalized scripts/,
    );
    expect(
      parseAndValidateSignedPsbt(hex(tx), hex(tx)).signed.getInput(0)
        .finalScriptWitness,
    ).toBeDefined();
  });
  it("preserves unchanged finalized witness inputs with an explicit empty scriptSig", () => {
    const tx = txFor();
    signEcdsa(tx);
    tx.finalizeIdx(0);
    const finalized = mutate(hex(tx), (raw) => {
      raw.inputs[0].finalScriptSig = new Uint8Array();
    });
    const result = parseAndValidateSignedPsbt(finalized, finalized).signed;
    expect(result.getInput(0).finalScriptWitness).toEqual(
      tx.getInput(0).finalScriptWitness,
    );
  });
  it.each([0, 2])(
    "preserves version %i and unknown/proprietary fields",
    (version) => {
      const tx = txFor(PAY.script, 1, version);
      tx.updateInput(0, {
        unknown: [
          [{ type: 0xee, key: new Uint8Array([1]) }, new Uint8Array([2])],
        ],
        proprietary: [[new Uint8Array([1, 1, 0]), new Uint8Array([3])]],
      });
      const before = hex(tx);
      const after = signEcdsa(tx);
      const result = parseAndValidateSignedPsbt(before, after).signed;
      expect(result.getInput(0).unknown).toEqual(tx.getInput(0).unknown);
      expect(result.getInput(0).proprietary).toEqual(
        tx.getInput(0).proprietary,
      );
      const raw = (version === 2 ? RawPSBTV2 : RawPSBTV0).decode(
        result.toPSBT(),
      );
      expect(raw.global.version ?? 0).toBe(version);
    },
  );
  it.each([-1, 0.5, 1, NaN])("rejects invalid requested index %s", (index) => {
    expect(() =>
      validateInputSelection(
        [ccc.InputToSign.from({ index, publicKey: PUB })],
        1,
      ),
    ).toThrow(/index/i);
  });
  it("deduplicates identical selections and rejects conflicting options", () => {
    expect(
      validateInputSelection([...policy(1), ...policy(1)], 1),
    ).toHaveLength(1);
    expect(() =>
      validateInputSelection([...policy(1), ...policy(2)], 1),
    ).toThrow(/Conflicting/);
  });
  it("rejects malformed ECDSA DER", () => {
    const before = hex(txFor());
    const after = mutate(before, (raw) => {
      raw.inputs[0].partialSig = [[PUB, new Uint8Array([0x30, 0, 1])]];
    });
    expect(() => parseAndValidateSignedPsbt(before, after)).toThrow();
  });
  it("rejects invalid ECDSA hash-mode encoding", () => {
    const before = hex(txFor());
    const after = mutate(signEcdsa(txFor()), (raw) => {
      raw.inputs[0].partialSig![0][1][
        raw.inputs[0].partialSig![0][1].length - 1
      ] = 0;
    });
    expect(() => parseAndValidateSignedPsbt(before, after)).toThrow(/sighash/);
  });
  it.each([0, 4, 0x80])("rejects explicit 65-byte Schnorr mode %i", (mode) => {
    const { before, after } = signedTaproot();
    const invalid = mutate(after, (raw) => {
      raw.inputs[0].tapKeySig = Uint8Array.from(
        ccc.bytesConcat(raw.inputs[0].tapKeySig!, [mode]),
      );
    });
    expect(() => parseAndValidateSignedPsbt(before, invalid)).toThrow();
  });
  it("rejects an invalid output-key signature", () => {
    const { before, after } = signedTaproot();
    const invalid = mutate(after, (raw) => {
      raw.inputs[0].tapKeySig![0] ^= 1;
    });
    expect(() => parseAndValidateSignedPsbt(before, invalid)).toThrow(
      /signature/i,
    );
  });
  it("verifies SINGLE at the original nonzero input index", () => {
    const { before, after, tx } = signedTaproot(3, 2, 1);
    expect(
      parseAndValidateSignedPsbt(before, after).signed.getInput(1).tapKeySig,
    ).toBeDefined();
    expect(() => verifyTaprootKeySignature(tx, 1)).not.toThrow();
  });
  it("requires all committed prevouts for a non-ANYONECANPAY signature", () => {
    const { before, after } = signedTaproot(1, 2, 1);
    const strip = (psbt: ccc.Hex) =>
      mutate(psbt, (raw) => {
        delete raw.inputs[0].witnessUtxo;
        delete raw.inputs[0].tapInternalKey;
      });
    expect(() =>
      parseAndValidateSignedPsbt(strip(before), strip(after)),
    ).toThrow(/Missing previous output/);
  });
  it("permits missing unrelated prevouts with ANYONECANPAY", () => {
    const { before, after } = signedTaproot(0x83, 2, 1);
    const strip = (psbt: ccc.Hex) =>
      mutate(psbt, (raw) => {
        delete raw.inputs[0].witnessUtxo;
        delete raw.inputs[0].tapInternalKey;
      });
    expect(
      parseAndValidateSignedPsbt(strip(before), strip(after)).signed.getInput(1)
        .tapKeySig,
    ).toBeDefined();
  });
  it("restores omitted Taproot tree metadata and accepts initially unknown roots", () => {
    const payment = btc.p2tr(schnorr.getPublicKey(KEY), {
      script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
    });
    const tx = txFor(payment.script);
    tx.updateInput(0, {
      tapInternalKey: payment.tapInternalKey,
      tapMerkleRoot: payment.tapMerkleRoot,
      tapLeafScript: payment.tapLeafScript,
    });
    const before = hex(tx);
    tx.signIdx(KEY, 0);
    const complete = hex(tx);
    const strip = (psbt: ccc.Hex) =>
      mutate(psbt, (raw) => {
        delete raw.inputs[0].tapMerkleRoot;
        delete raw.inputs[0].tapLeafScript;
      });
    const restored = parseAndValidateSignedPsbt(before, strip(complete)).signed;
    expect(restored.getInput(0).tapMerkleRoot).toEqual(payment.tapMerkleRoot);
    expect(
      parseAndValidateSignedPsbt(
        strip(before),
        strip(complete),
      ).signed.getInput(0).tapKeySig,
    ).toBeDefined();
    const incomplete = btc.Transaction.fromPSBT(
      ccc.bytesFrom(strip(before)),
      FIXTURE_OPTIONS,
    );
    // Stock scure may sign using an assumed empty root. The wallet boundary must
    // reject that signature against the actual tree-bearing previous output.
    incomplete.signIdx(KEY, 0);
    expect(() =>
      parseAndValidateSignedPsbt(strip(before), hex(incomplete)),
    ).toThrow(/Invalid Taproot key-path signature/);
  });
  it("still rejects conflicting Taproot roots and control-block parity", () => {
    const payment = btc.p2tr(schnorr.getPublicKey(KEY), {
      script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
    });
    const tx = txFor(payment.script);
    tx.updateInput(0, {
      tapInternalKey: payment.tapInternalKey,
      tapMerkleRoot: payment.tapMerkleRoot,
      tapLeafScript: payment.tapLeafScript,
    });
    const before = hex(tx);
    const root = mutate(before, (raw) => {
      raw.inputs[0].tapMerkleRoot![0] ^= 1;
    });
    expect(() => parseAndValidateSignedPsbt(before, root)).toThrow();
    const parity = mutate(before, (raw) => {
      raw.inputs[0].tapLeafScript![0][0].version ^= 1;
    });
    expect(() => parseAndValidateSignedPsbt(before, parity)).toThrow(/parity/);
  });
  it.each([btc.p2pk(OTHER_PUB).script, btc.p2ms(1, [OTHER_PUB]).script])(
    "parses an unrelated bare input and retains wrapped-script checks",
    (script) => {
      const tx = txFor();
      tx.addInput({
        txid: new Uint8Array(32).fill(9),
        index: 0,
        witnessUtxo: { amount: 10000n, script },
      });
      const before = hex(tx);
      const after = signEcdsa(tx);
      expect(
        parseAndValidateSignedPsbt(before, after).signed.inputsLength,
      ).toBe(2);
      const bad = mutate(before, (raw) => {
        raw.inputs[0].redeemScript = script;
      });
      expect(() => parseAndValidateSignedPsbt(before, bad)).toThrow(
        /redeemScript/,
      );
    },
  );
  it("rejects actual-signature mismatch at the wallet boundary before cleanup", () => {
    const signed = signEcdsa(txFor(), 2);
    const mismatched = mutate(signed, (raw) => {
      raw.inputs[0].sighashType = 1;
    });
    const tx = btc.Transaction.fromPSBT(
      ccc.bytesFrom(mismatched),
      FIXTURE_OPTIONS,
    );
    expect(() => parseAndValidateSignedPsbt(mismatched, mismatched)).toThrow(
      /sighash/,
    );
    expect(tx.getInput(0).sighashType).toBe(1);
    expect(tx.getInput(0).partialSig).toHaveLength(1);
    expect(tx.getInput(0).finalScriptWitness).toBeUndefined();
  });
});

describe.each([0, 2])("parser compatibility in PSBTv%i", (version) => {
  it.each([btc.p2pk(PUB).script, btc.p2ms(1, [PUB]).script])(
    "accepts bare inputs while rejecting stray wrapper and Taproot metadata",
    (script) => {
      const before = hex(txFor(script, 1, version));
      const parsed = parseAndValidateSignedPsbt(before, before).signed;
      expect("updateInput" in parsed).toBe(false);
      expect(parsed.getInput(0).witnessUtxo?.script).toEqual(script);
      for (const field of ["redeemScript", "witnessScript"] as const) {
        const invalid = mutate(
          before,
          (raw) => {
            raw.inputs[0][field] = script;
          },
          version,
        );
        expect(() => parseAndValidateSignedPsbt(invalid, invalid)).toThrow(
          field,
        );
      }
      for (const field of ["tapInternalKey", "tapMerkleRoot"] as const) {
        const invalid = mutate(
          before,
          (raw) => {
            raw.inputs[0][field] = schnorr.getPublicKey(KEY);
          },
          version,
        );
        expect(() => parseAndValidateSignedPsbt(invalid, invalid)).toThrow(
          /Taproot metadata/,
        );
      }
    },
  );

  it("still validates explicit roots and leaves without trusted request metadata", () => {
    const payment = btc.p2tr(schnorr.getPublicKey(KEY), {
      script: btc.p2tr_pk(schnorr.getPublicKey(OTHER)).script,
    });
    const tx = txFor(payment.script, 1, version);
    tx.updateInput(0, {
      tapInternalKey: payment.tapInternalKey,
      tapMerkleRoot: payment.tapMerkleRoot,
      tapLeafScript: payment.tapLeafScript,
    });
    const complete = hex(tx);
    for (const field of ["root", "parity", "internalKey", "leaf"] as const) {
      const invalid = mutate(
        complete,
        (raw) => {
          const input = raw.inputs[0];
          if (field === "root") {
            delete input.tapLeafScript;
            input.tapMerkleRoot![0] ^= 1;
          } else if (field === "parity") {
            delete input.tapMerkleRoot;
            input.tapLeafScript![0][0].version ^= 1;
          } else if (field === "internalKey") {
            delete input.tapMerkleRoot;
            input.tapInternalKey = schnorr.getPublicKey(OTHER);
          } else {
            input.tapLeafScript![0][1][1] ^= 1;
          }
        },
        version,
      );
      expect(() => parseAndValidateSignedPsbt(invalid, invalid)).toThrow();
    }
    const leavesOnly = mutate(
      complete,
      (raw) => {
        delete raw.inputs[0].tapMerkleRoot;
      },
      version,
    );
    expect(
      parseAndValidateSignedPsbt(leavesOnly, leavesOnly).signed.getInput(0)
        .tapLeafScript,
    ).toEqual(payment.tapLeafScript);
  });

  it("validates wrapped script commitments independently of transaction binding", () => {
    for (const payment of [btc.p2sh(PAY), btc.p2wsh(btc.p2ms(1, [PUB]))]) {
      const tx = txFor(payment.script, 1, version);
      const field = payment.type === "sh" ? "redeemScript" : "witnessScript";
      tx.updateInput(
        0,
        payment.type === "sh"
          ? { redeemScript: payment.redeemScript }
          : { witnessScript: payment.witnessScript },
      );
      const invalid = mutate(
        hex(tx),
        (raw) => {
          raw.inputs[0][field]![0] ^= 1;
        },
        version,
      );
      expect(() => parseAndValidateSignedPsbt(invalid, invalid)).toThrow(
        /wrong.*hash/,
      );
    }
  });

  it("checks nonWitnessUtxo txids and redundant prevouts on bare inputs", () => {
    const tx = singleKeyTx(btc.p2pk(PUB));
    const before = ccc.hexFrom(tx.toPSBT(version));
    const wrongTxid = mutate(
      before,
      (raw) => {
        if (version === 0) {
          raw.global.unsignedTx!.inputs[0].txid[0] ^= 1;
        } else {
          raw.inputs[0].txid![0] ^= 1;
        }
      },
      version,
    );
    expect(() => parseAndValidateSignedPsbt(wrongTxid, wrongTxid)).toThrow(
      /wrong txid/,
    );
    const wrongAmount = mutate(
      before,
      (raw) => {
        raw.inputs[0].witnessUtxo = {
          script: btc.p2pk(PUB).script,
          amount: 1n,
        };
      },
      version,
    );
    expect(() => parseAndValidateSignedPsbt(wrongAmount, wrongAmount)).toThrow(
      /different from nonWitnessUtxo/,
    );
  });
});
