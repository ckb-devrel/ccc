import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import { RawPSBTV0 } from "@scure/btc-signer/psbt.js";
import { describe, expect, it } from "vitest";
import { PSBT_OPTIONS, finalizeReadyInputs, parsePsbt } from "./index.js";

const key = new Uint8Array(32).fill(1);
const pub = secp256k1.getPublicKey(key);
const payment = btc.p2wpkh(pub);
const options = PSBT_OPTIONS;
const scripts = [
  ["wpkh", payment],
  ["sh-wpkh", btc.p2sh(payment)],
  ["pkh", btc.p2pkh(pub)],
  ["sh-pkh", btc.p2sh(btc.p2pkh(pub))],
  ["wsh-pkh", btc.p2wsh(btc.p2pkh(pub))],
  ["sh-wsh-pkh", btc.p2sh(btc.p2wsh(btc.p2pkh(pub)))],
  ["sh-pk", btc.p2sh(btc.p2pk(pub))],
  ["wsh-pk", btc.p2wsh(btc.p2pk(pub))],
  ["sh-wsh-pk", btc.p2sh(btc.p2wsh(btc.p2pk(pub)))],
  ["wsh-ms", btc.p2wsh(btc.p2ms(1, [pub]))],
  ["tr", btc.p2tr(schnorr.getPublicKey(key))],
] as const;

describe.each([0, 2])("per-input finalization in PSBTv%i", (version) => {
  it.each(scripts)(
    "finalizes ready %s inputs with complete UTXOs",
    (_name, spend) => {
      const previous = new btc.Transaction(options);
      previous.addInput({ txid: new Uint8Array(32).fill(7), index: 0 });
      previous.addOutput({ script: spend.script, amount: 10000n });
      const source = new btc.Transaction({ ...options, PSBTVersion: version });
      source.addInput({
        txid: new Uint8Array(32).fill(2),
        index: 0,
        witnessUtxo: { script: payment.script, amount: 10000n },
      });
      source.addInput({
        txid: previous.id,
        index: 0,
        nonWitnessUtxo: previous.toBytes(true, true),
        ...spend,
      });
      source.addOutput({ script: payment.script, amount: 9000n });
      source.updateInput(1, { sighashType: 0x81 });
      source.signIdx(key, 1, [0x81]);
      const tx = parsePsbt(source.toPSBT());
      finalizeReadyInputs(tx);
      const result = parsePsbt(tx.toPSBT());
      expect(result.getInput(0).finalScriptWitness).toBeUndefined();
      expect(result.getInput(0).finalScriptSig).toBeUndefined();
      expect(
        result.getInput(1).finalScriptSig?.length ||
          result.getInput(1).finalScriptWitness?.length,
      ).toBeGreaterThan(0);
    },
  );

  it("leaves the PSBT unchanged when the input cannot be finalized", () => {
    const source = new btc.Transaction({ ...options, PSBTVersion: version });
    source.addInput({
      txid: new Uint8Array(32).fill(1),
      index: 0,
      witnessUtxo: { script: payment.script, amount: 10000n },
    });
    source.addOutput({ script: payment.script, amount: 9000n });
    const bytes = source.toPSBT();
    const tx = parsePsbt(bytes);
    finalizeReadyInputs(tx);
    expect(tx.toPSBT()).toEqual(bytes);
  });
});

const otherKey = new Uint8Array(32).fill(2);
const otherPub = secp256k1.getPublicKey(otherKey);
function witnessTransaction(spend: {
  script: Uint8Array;
  [key: string]: unknown;
}) {
  const tx = new btc.Transaction(options);
  tx.addInput({
    txid: new Uint8Array(32).fill(1),
    index: 0,
    witnessUtxo: { script: spend.script, amount: 10000n },
    ...spend,
  });
  tx.addOutput({ script: payment.script, amount: 9000n });
  return tx;
}
function finish(source: btc.Transaction) {
  const tx = parsePsbt(source.toPSBT());
  finalizeReadyInputs(tx);
  return tx;
}

describe("best-effort finalization", () => {
  it("preserves incomplete multisig, then finalizes when the threshold is met", () => {
    const source = witnessTransaction(
      btc.p2sh(btc.p2wsh(btc.p2ms(2, [pub, otherPub]))),
    );
    source.signIdx(key, 0);
    expect(finish(source).toPSBT()).toEqual(source.toPSBT());
    source.signIdx(otherKey, 0);
    expect(finish(source).isFinal).toBe(true);
  });

  it("keeps an unrelated signature without treating it as a ready P2WPKH input", () => {
    const source = witnessTransaction(payment);
    source.signIdx(key, 0);
    const raw = RawPSBTV0.decode(source.toPSBT());
    raw.inputs[0].partialSig![0][0] = otherPub;
    const bytes = RawPSBTV0.encode(raw);
    const tx = parsePsbt(bytes);
    finalizeReadyInputs(tx);
    expect(tx.toPSBT()).toEqual(bytes);
  });

  it("preserves finalized inputs and skips unknown scripts and missing wrapper data", () => {
    const source = witnessTransaction(payment);
    source.addInput({
      txid: new Uint8Array(32).fill(2),
      index: 0,
      witnessUtxo: { script: new Uint8Array([0x51]), amount: 10000n },
    });
    source.addInput({
      txid: new Uint8Array(32).fill(3),
      index: 0,
      witnessUtxo: { script: btc.p2sh(payment).script, amount: 10000n },
    });
    source.signIdx(key, 0);
    source.finalizeIdx(0);
    const complete = source.getInput(0);
    const result = finish(source);
    expect(result.getInput(0)).toEqual(complete);
    expect(result.toPSBT()).toEqual(source.toPSBT());
  });

  it.each([
    [
      "tr_ms",
      btc.p2tr_ms(2, [
        schnorr.getPublicKey(key),
        schnorr.getPublicKey(otherKey),
      ]),
    ],
    [
      "tr_ns",
      btc.p2tr_ns(2, [
        schnorr.getPublicKey(key),
        schnorr.getPublicKey(otherKey),
      ])[0],
    ],
  ] as const)(
    "matches signatures to the %s leaf and threshold",
    (_name, leaf) => {
      const spend = btc.p2tr(schnorr.getPublicKey(new Uint8Array(32).fill(3)), {
        script: leaf.script,
      });
      const source = witnessTransaction(spend);
      source.signIdx(key, 0);
      expect(finish(source).toPSBT()).toEqual(source.toPSBT());
      source.signIdx(otherKey, 0);
      expect(finish(source).isFinal).toBe(true);
      const raw = RawPSBTV0.decode(source.toPSBT());
      raw.inputs[0].tapScriptSig![0][0].leafHash = new Uint8Array(32);
      const bytes = RawPSBTV0.encode(raw);
      const tx = parsePsbt(bytes);
      finalizeReadyInputs(tx);
      expect(tx.toPSBT()).toEqual(bytes);
    },
  );
});

describe("stock scure parsing and finalization", () => {
  it("reports bare P2PK inputs using normal parsing", () => {
    const raw = RawPSBTV0.decode(witnessTransaction(payment).toPSBT());
    raw.inputs[0].witnessUtxo!.script = btc.p2pk(pub).script;
    expect(() => parsePsbt(RawPSBTV0.encode(raw))).toThrow(/non-wrapped pk/);
  });

  it("reports omitted Taproot tree metadata instead of bypassing script checks", () => {
    const spend = btc.p2tr(schnorr.getPublicKey(key), {
      script: btc.p2tr_pk(schnorr.getPublicKey(otherKey)).script,
    });
    const raw = RawPSBTV0.decode(witnessTransaction(spend).toPSBT());
    delete raw.inputs[0].tapMerkleRoot;
    delete raw.inputs[0].tapLeafScript;
    expect(() => parsePsbt(RawPSBTV0.encode(raw))).toThrow(
      /Taproot commitment/,
    );
  });

  it("reports an invalid total fee from the original transaction", () => {
    const source = witnessTransaction(payment);
    source.updateOutput(0, { amount: 20000n });
    source.signIdx(key, 0);
    try {
      finish(source);
      expect.fail("Expected the original transaction fee check to fail");
    } catch (error) {
      expect(error).toMatchObject({
        message: "Failed to finalize PSBT input #0.",
        cause: { message: "Outputs spends more than inputs amount" },
      });
    }
  });
});
