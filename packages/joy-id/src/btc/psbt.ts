import { ccc } from "@ckb-ccc/core";
import { Transaction, type TxOpts } from "@scure/btc-signer";

type PsbtInput = ReturnType<Transaction["getInput"]>;
type PsbtInputUpdate = Parameters<Transaction["updateInput"]>[1];

// scure drops unknown PSBT fields by default.
const PSBT_OPTIONS: TxOpts = { unknown: "ignore", proprietary: "ignore" };

// finalizeIdx needs every input's UTXO to check the fee, so finalize the input
// alone.
function finalizeInput(tx: Transaction, index: number) {
  const input = tx.getInput(index);
  const scratch = new Transaction(PSBT_OPTIONS);
  scratch.addInput(input);
  scratch.finalizeIdx(0);
  const finalized = scratch.getInput(0);
  const cleared = Object.fromEntries(
    Object.keys(input)
      .filter((key) => !(key in finalized))
      .map((key) => [key, undefined]),
  ) as PsbtInputUpdate;

  // Fields a signature commits to can't be cleared while it exists.
  tx.updateInput(index, {
    partialSig: undefined,
    tapKeySig: undefined,
    tapScriptSig: undefined,
  });
  tx.updateInput(index, {
    ...cleared,
    finalScriptSig: finalized.finalScriptSig,
    finalScriptWitness: finalized.finalScriptWitness,
  });
}

function inputsOf(tx: Transaction): PsbtInput[] {
  return Array.from({ length: tx.inputsLength }, (_, i) => tx.getInput(i));
}

function isFinalized(input: PsbtInput) {
  return !!(input.finalScriptSig || input.finalScriptWitness);
}

// Compare by content so a replaced signature counts as new.
function signatureEntries(input: PsbtInput | undefined): Set<string> {
  const entries = new Set<string>();
  input?.partialSig?.forEach(([pubkey, signature]) =>
    entries.add(`partial:${ccc.hexFrom(pubkey)}:${ccc.hexFrom(signature)}`),
  );
  if (input?.tapKeySig) {
    entries.add(`tapKey:${ccc.hexFrom(input.tapKeySig)}`);
  }
  input?.tapScriptSig?.forEach(([{ pubKey, leafHash }, signature]) =>
    entries.add(
      `tapScript:${ccc.hexFrom(pubKey)}:${ccc.hexFrom(leafHash)}:${ccc.hexFrom(signature)}`,
    ),
  );
  return entries;
}

function hasNewSignature(
  before: PsbtInput | undefined,
  after: PsbtInput,
): boolean {
  const existing = signatureEntries(before);
  return [...signatureEntries(after)].some((entry) => !existing.has(entry));
}

function finalizeInputs(tx: Transaction, indexes: Set<number>): ccc.Hex {
  try {
    for (const index of indexes) {
      finalizeInput(tx, index);
    }
  } catch (error) {
    throw new Error(
      "Failed to finalize the PSBT signed by JoyID. " +
        "Use { autoFinalized: false } for partial or multisig signing.",
      { cause: error },
    );
  }

  return ccc.hexFrom(tx.toPSBT());
}

/**
 * Checks that JoyID returned a PSBT of the same transaction.
 */
export function parseSignedPsbt(
  unsignedPsbtHex: ccc.Hex,
  signedPsbtHex: ccc.Hex,
): { unsigned: Transaction; signed: Transaction } {
  if (!signedPsbtHex.startsWith("0x70736274ff")) {
    throw new Error("JoyID did not return a PSBT.");
  }

  const unsigned = Transaction.fromPSBT(
    ccc.bytesFrom(unsignedPsbtHex),
    PSBT_OPTIONS,
  );
  let signed: Transaction;
  try {
    signed = Transaction.fromPSBT(ccc.bytesFrom(signedPsbtHex), PSBT_OPTIONS);
  } catch (error) {
    throw new Error("JoyID returned an invalid PSBT.", { cause: error });
  }

  if (ccc.hexFrom(unsigned.unsignedTx) !== ccc.hexFrom(signed.unsignedTx)) {
    throw new Error("JoyID returned a PSBT for a different transaction.");
  }

  return { unsigned, signed };
}

/**
 * Finalizes the inputs JoyID signed. Inputs signed only by others are skipped,
 * and every requested input must be signed by JoyID.
 *
 * Inputs that already had a JoyID signature are not supported, as re-signing
 * produces the same bytes.
 */
export function finalizeSignedInputs(
  unsigned: Transaction,
  signed: Transaction,
  inputsToSign: ccc.InputToSign[],
): ccc.Hex {
  const before = inputsOf(unsigned);
  const after = inputsOf(signed);
  const signedIndexes = new Set(
    after.flatMap((input, index) =>
      !isFinalized(input) && hasNewSignature(before[index], input)
        ? [index]
        : [],
    ),
  );

  if (inputsToSign.length === 0) {
    return finalizeInputs(signed, signedIndexes);
  }

  const requestedIndexes = new Set<number>();
  for (const { index } of inputsToSign) {
    const input = after[index];
    if (input && isFinalized(input)) {
      continue;
    }
    if (!signedIndexes.has(index)) {
      throw new Error(
        `JoyID did not add a signature to the requested input #${index}.`,
      );
    }
    requestedIndexes.add(index);
  }
  return finalizeInputs(signed, requestedIndexes);
}
