import { ccc } from "@ckb-ccc/core";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1.js";
import { OutScript, Transaction, type TxOpts } from "@scure/btc-signer";
import { RawPSBTV0, RawPSBTV2 } from "@scure/btc-signer/psbt.js";
import {
  getInputType,
  getPrevOut,
  normalizeInput,
} from "@scure/btc-signer/transaction.js";
import { hash160 } from "@scure/btc-signer/utils.js";

export const PSBT_OPTIONS: Readonly<TxOpts> = Object.freeze({
  unknown: "ignore",
  proprietary: "ignore",
});
type Input = ReturnType<Transaction["getInput"]>;
type TransactionView = Pick<
  Transaction,
  "getInput" | "inputsLength" | "opts" | "preimageWitnessV1"
>;
type RawPsbt = ReturnType<typeof RawPSBTV0.decode>;
const HASH_MODES = [1, 2, 3, 0x81, 0x82, 0x83];

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return ccc.hexFrom(a) === ccc.hexFrom(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((value, index) => same(value, b[index]))
    );
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = Object.entries(a);
    const right = Object.entries(b);
    return (
      left.length === right.length &&
      left.every(([key, value]) =>
        right.some(
          ([otherKey, otherValue]) =>
            key === otherKey && same(value, otherValue),
        ),
      )
    );
  }
  return a === b;
}

export function validateInputSelection(
  inputs: ccc.InputToSign[],
  count: number,
): ccc.InputToSign[] {
  const selected = new Map<number, ccc.InputToSign>();
  for (const input of inputs) {
    if (
      !Number.isSafeInteger(input.index) ||
      input.index < 0 ||
      input.index >= count
    ) {
      throw new Error(`Invalid PSBT input index #${input.index}.`);
    }
    if (
      input.sighashTypes?.some(
        (mode) => mode !== 0 && !HASH_MODES.includes(mode),
      )
    ) {
      throw new Error(`Invalid sighashTypes for input #${input.index}.`);
    }
    const previous = selected.get(input.index);
    if (previous && !same(previous, input)) {
      throw new Error(`Conflicting signing options for input #${input.index}.`);
    }
    selected.set(input.index, input);
  }
  return [...selected.values()];
}

function decodePsbt(bytes: Uint8Array): RawPsbt {
  try {
    return RawPSBTV0.decode(bytes);
  } catch (error) {
    try {
      return RawPSBTV2.decode(bytes);
    } catch {
      throw error;
    }
  }
}

function encodePsbt(raw: RawPsbt): Uint8Array {
  return raw.global.version === 2
    ? RawPSBTV2.encode(raw)
    : RawPSBTV0.encode(raw);
}

export function isFinalized(input: Input): boolean {
  return !!(input.finalScriptSig?.length || input.finalScriptWitness?.length);
}

export function signatureEntries(
  input: Input,
): Map<string, { signature: Uint8Array; taproot: boolean }> {
  const entries = new Map<
    string,
    { signature: Uint8Array; taproot: boolean }
  >();
  input.partialSig?.forEach(([key, signature]) =>
    entries.set(`ecdsa:${ccc.hexFrom(key)}`, { signature, taproot: false }),
  );
  if (input.tapKeySig) {
    entries.set("tapKey", { signature: input.tapKeySig, taproot: true });
  }
  input.tapScriptSig?.forEach(([{ pubKey, leafHash }, signature]) =>
    entries.set(`tapScript:${ccc.hexFrom(pubKey)}:${ccc.hexFrom(leafHash)}`, {
      signature,
      taproot: true,
    }),
  );
  return entries;
}

export function hasNewSignature(before: Input, after: Input): boolean {
  const existing = signatureEntries(before);
  return [...signatureEntries(after)].some(
    ([key, { signature }]) => !same(existing.get(key)?.signature, signature),
  );
}

function signatureMode(signature: Uint8Array, taproot: boolean): number {
  if (taproot) {
    if (signature.length === 64) {
      return 0;
    }
    if (signature.length === 65 && HASH_MODES.includes(signature[64])) {
      return signature[64];
    }
    throw new Error("Invalid Schnorr signature encoding or sighash.");
  }
  secp256k1.Signature.fromBytes(signature.subarray(0, -1), "der");
  const mode = signature[signature.length - 1];
  if (!HASH_MODES.includes(mode)) {
    throw new Error("Invalid ECDSA signature sighash.");
  }
  return mode;
}

/** Check the ECDSA candidate scure will use for a single-key satisfaction. */
export function verifyFinalizerPubkey(
  tx: TransactionView,
  index: number,
): void {
  const input = tx.getInput(index);
  const pubkey = input.partialSig?.[0]?.[0];
  if (!pubkey) {
    return;
  }
  // Inputs have already passed script-commitment checks. Resolve P2SH/P2WSH
  // wrappers exactly as the finalizer does, without changing signature selection.
  const { last } = getInputType(input, tx.opts.allowLegacyWitnessUtxo);
  const matches =
    last.type === "pkh" || last.type === "wpkh"
      ? same(hash160(pubkey), last.hash)
      : last.type === "pk"
        ? secp256k1.Point.fromBytes(pubkey).equals(
            secp256k1.Point.fromBytes(last.pubkey),
          )
        : true;
  if (!matches) {
    throw new Error(
      `Signature public key does not match input #${index} script.`,
    );
  }
}

// Verify in the complete transaction and at its original index, never the scratch finalizer.
export function verifyTaprootKeySignature(
  tx: TransactionView,
  index: number,
): void {
  const input = tx.getInput(index);
  if (!input.tapKeySig) {
    return;
  }
  const mode = signatureMode(input.tapKeySig, true);
  const output = OutScript.decode(getPrevOut(input).script);
  if (output.type !== "tr") {
    throw new Error("Taproot signature without a Taproot previous output.");
  }
  const prevouts = Array.from({ length: tx.inputsLength }, (_, i) => {
    // ANYONECANPAY does not commit to other prevouts. Placeholders are never hashed.
    if (i !== index && mode & 0x80) {
      return { amount: 0n, script: new Uint8Array() };
    }
    try {
      return getPrevOut(tx.getInput(i));
    } catch (error) {
      throw new Error(
        `Missing previous output required to verify Taproot input #${index}.`,
        { cause: error },
      );
    }
  });
  const digest = tx.preimageWitnessV1(
    index,
    prevouts.map(({ script }) => script),
    mode,
    prevouts.map(({ amount }) => amount),
  );
  if (!schnorr.verify(input.tapKeySig.subarray(0, 64), digest, output.pubkey)) {
    throw new Error(`Invalid Taproot key-path signature for input #${index}.`);
  }
}

/** Bind a wallet response to the request before restoring omitted, trusted metadata. */
export function parseAndValidateSignedPsbt(
  unsignedPsbtHex: ccc.Hex,
  signedPsbtHex: ccc.Hex,
  inputsToSign: ccc.InputToSign[] = [],
  wallet = "Wallet",
): { unsigned: WalletPsbt; signed: WalletPsbt } {
  if (!signedPsbtHex.startsWith("0x70736274ff")) {
    throw new Error(`${wallet} did not return a PSBT.`);
  }
  const unsigned = WalletPsbt.fromPSBT(ccc.bytesFrom(unsignedPsbtHex));
  const selected = validateInputSelection(inputsToSign, unsigned.inputsLength);
  let raw: RawPsbt;
  try {
    raw = decodePsbt(ccc.bytesFrom(signedPsbtHex));
  } catch (error) {
    throw new Error(`${wallet} returned an invalid PSBT.`, { cause: error });
  }
  // Parse only the transaction framing first. After binding the effective transaction,
  // restore trusted metadata and validate every input through WalletPsbt below.
  const framing = {
    ...raw,
    inputs: raw.inputs.map((input) =>
      Object.fromEntries(
        Object.entries(input).filter(([key]) =>
          [
            "txid",
            "index",
            "sequence",
            "requiredHeightLocktime",
            "requiredTimeLocktime",
          ].includes(key),
        ),
      ),
    ),
  };
  const responseTx = Transaction.fromPSBT(encodePsbt(framing), PSBT_OPTIONS);
  if (!same(unsigned.unsignedTx, responseTx.unsignedTx)) {
    throw new Error(`${wallet} returned a PSBT for a different transaction.`);
  }
  const restoreFields = [
    "nonWitnessUtxo",
    "witnessUtxo",
    "redeemScript",
    "witnessScript",
    "sighashType",
    "tapInternalKey",
    "tapMerkleRoot",
    "requiredHeightLocktime",
    "requiredTimeLocktime",
  ] as const;
  for (let index = 0; index < unsigned.inputsLength; index++) {
    const before = unsigned.getInput(index);
    const after = raw.inputs[index];
    // Match the parser's normalization: empty final fields do not finalize an input.
    if (!after.finalScriptSig?.length) {
      delete after.finalScriptSig;
    }
    if (!after.finalScriptWitness?.length) {
      delete after.finalScriptWitness;
    }
    if (
      !same(before.finalScriptSig, after.finalScriptSig) ||
      !same(before.finalScriptWitness, after.finalScriptWitness)
    ) {
      throw new Error(
        `${wallet} changed finalized scripts for input #${index}. Request an unfinalized PSBT.`,
      );
    }
    for (const field of restoreFields) {
      const original = before[field];
      if (original === undefined) {
        continue;
      }
      if (after[field] !== undefined && !same(original, after[field])) {
        throw new Error(`${wallet} changed ${field} for input #${index}.`);
      }
      Object.assign(after, { [field]: original });
    }
    // Restore known leaves by control block; never restore old signatures or overwrite conflicts.
    if (before.tapLeafScript) {
      const leaves = after.tapLeafScript ?? [];
      for (const original of before.tapLeafScript) {
        const found = leaves.find(([control]) => same(control, original[0]));
        if (found && !same(found[1], original[1])) {
          throw new Error(
            `${wallet} changed tapLeafScript for input #${index}.`,
          );
        }
        if (!found) {
          leaves.push(original);
        }
      }
      after.tapLeafScript = leaves;
    }
  }
  const signed = WalletPsbt.fromPSBT(encodePsbt(raw));
  // Restored PSBTv2 constraints can change the effective locktime. Bind again
  // after metadata restoration so the returned transaction remains unchanged.
  if (!same(unsigned.unsignedTx, signed.unsignedTx)) {
    throw new Error(`${wallet} returned a PSBT for a different transaction.`);
  }
  for (let index = 0; index < unsigned.inputsLength; index++) {
    const before = unsigned.getInput(index);
    const after = signed.getInput(index);
    const existing = signatureEntries(before);
    const returned = signatureEntries(after);
    for (const key of existing.keys()) {
      if (!returned.has(key)) {
        throw new Error(
          `${wallet} removed an existing signature for input #${index}.`,
        );
      }
    }
    const allowed = selected.find(
      (input) => input.index === index,
    )?.sighashTypes;
    for (const [key, { signature, taproot }] of returned) {
      const mode = signatureMode(signature, taproot);
      if (after.sighashType !== undefined && mode !== after.sighashType) {
        throw new Error(
          `${wallet} returned a signature with a conflicting sighash for input #${index}.`,
        );
      }
      const added = !same(existing.get(key)?.signature, signature);
      if (added && allowed && !allowed.includes(mode)) {
        throw new Error(
          `${wallet} returned a disallowed signature sighash for input #${index}.`,
        );
      }
      if (added && key === "tapKey") {
        verifyTaprootKeySignature(signed, index);
      }
    }
  }
  return { unsigned, signed };
}

/** Validate using public scure APIs; return whether the input needs compatibility. */
function validateInput(input: Input): boolean {
  const normalize = (value: Input, disableScriptCheck = false) =>
    normalizeInput(
      value,
      undefined,
      undefined,
      disableScriptCheck,
      "ignore",
      "ignore",
    );
  // Validate field encodings/public keys, txids, redundant UTXOs and locktimes
  // BEFORE omitting anything from the validation-only projection below.
  const checked = normalize(input, true);
  if (
    checked.witnessUtxo === undefined &&
    checked.nonWitnessUtxo === undefined
  ) {
    normalize(checked);
    return false;
  }
  const output = OutScript.decode(getPrevOut(checked).script);
  if (output.type === "pk" || output.type === "ms") {
    // Bare scripts have no wrapper or Taproot commitments to check. Only scure's
    // rejection of these recognized bare script types is bypassed.
    if (checked.redeemScript !== undefined) {
      throw new Error("checkScript: redeemScript without P2SH");
    }
    if (checked.witnessScript !== undefined) {
      throw new Error("checkScript: witnessScript without P2WSH");
    }
    if (
      checked.tapInternalKey !== undefined ||
      checked.tapMerkleRoot !== undefined ||
      checked.tapLeafScript?.length
    ) {
      throw new Error(
        "validateInput: Taproot metadata without P2TR previous output",
      );
    }
    return true;
  }
  if (
    output.type === "tr" &&
    checked.tapInternalKey !== undefined &&
    checked.tapMerkleRoot === undefined &&
    !checked.tapLeafScript?.length
  ) {
    const projection = { ...checked };
    delete projection.tapInternalKey;
    // No root/leaves means unknown, not an empty tree. Keep the original key on
    // the transaction, and retain scure's wrapper/raw-witness-program checks.
    normalize(projection);
    return true;
  }
  normalize(checked); // Explicit roots/leaves and all other scripts stay strict.
  return false;
}

function validateInputs(tx: Transaction): void {
  for (let index = 0; index < tx.inputsLength; index++) {
    validateInput(tx.getInput(index));
  }
}

/**
 * Private wallet boundary around stock scure. No mutable Transaction escapes:
 * reads return copies, finalization is the only mutation, and every mutation or
 * serialization rechecks all inputs, including unrelated inputs.
 */
export class WalletPsbt {
  #tx: Transaction;

  private constructor(bytes: Uint8Array) {
    // Own the input bytes even if the decoder retains views into its buffer.
    const owned = Uint8Array.from(bytes);
    try {
      this.#tx = Transaction.fromPSBT(owned, PSBT_OPTIONS);
    } catch (strictError) {
      const tx = Transaction.fromPSBT(owned, {
        ...PSBT_OPTIONS,
        disableScriptCheck: true,
      });
      let compatible = false;
      for (let index = 0; index < tx.inputsLength; index++) {
        compatible = validateInput(tx.getInput(index)) || compatible;
      }
      if (!compatible) {
        throw strictError;
      }
      this.#tx = tx;
    }
  }

  static fromPSBT(bytes: Uint8Array): WalletPsbt {
    return new WalletPsbt(bytes);
  }

  getInput(index: number): Input {
    return this.#tx.getInput(index);
  }

  get inputsLength(): number {
    return this.#tx.inputsLength;
  }

  get unsignedTx(): Uint8Array {
    return this.#tx.unsignedTx;
  }

  get opts(): Transaction["opts"] {
    return this.#tx.opts;
  }

  get isFinal(): boolean {
    return this.#tx.isFinal;
  }

  preimageWitnessV1(
    ...args: Parameters<Transaction["preimageWitnessV1"]>
  ): Uint8Array {
    return this.#tx.preimageWitnessV1(...args);
  }

  toPSBT(): Uint8Array {
    validateInputs(this.#tx);
    return this.#tx.toPSBT();
  }

  finalizeInput(index: number): void {
    validateInputs(this.#tx);
    const input = this.#tx.getInput(index);
    // Response validation enforces caller policy. Also guard this sole mutation
    // entry point against malformed encodings/declarations on a parsed PSBT.
    for (const { signature, taproot } of signatureEntries(input).values()) {
      const mode = signatureMode(signature, taproot);
      if (input.sighashType !== undefined && mode !== input.sighashType) {
        throw new Error(`Signature sighash does not match input #${index}.`);
      }
    }
    verifyFinalizerPubkey(this.#tx, index);
    verifyTaprootKeySignature(this.#tx, index);
    // Verify signatures above in the complete transaction at the original index.
    // Scure's finalizer needs every UTXO for its fee check, so satisfy one input alone.
    const scratch = new Transaction({
      ...PSBT_OPTIONS,
      disableScriptCheck: validateInput(input),
    });
    scratch.addInput(input);
    scratch.finalizeIdx(0);
    const finalized = scratch.getInput(0);
    validateInput(finalized);
    const cleared = Object.fromEntries(
      Object.keys(input)
        .filter((key) => !(key in finalized))
        .map((key) => [key, undefined]),
    ) as Parameters<Transaction["updateInput"]>[1];

    // Stage the two cleanup updates privately; a failure must not remove existing
    // signatures or expose an unchecked intermediate state on this facade.
    const candidate = this.#tx.clone();
    candidate.updateInput(index, {
      partialSig: undefined,
      tapKeySig: undefined,
      tapScriptSig: undefined,
    });
    candidate.updateInput(index, {
      ...cleared,
      finalScriptSig: finalized.finalScriptSig,
      finalScriptWitness: finalized.finalScriptWitness,
    });
    validateInputs(candidate);
    this.#tx = candidate;
  }
}
