import * as ecc from "@bitcoinerlab/secp256k1";
import { ccc } from "@ckb-ccc/core";
import { initEccLib, Psbt } from "bitcoinjs-lib";

type PsbtInput = Psbt["data"]["inputs"][number];

let isEccLibInitialized = false;

// Required by bitcoinjs-lib to finalize Taproot inputs.
function ensureEccLib() {
  if (!isEccLibInitialized) {
    initEccLib(ecc);
    isEccLibInitialized = true;
  }
}

function isFinalized(input: PsbtInput) {
  return !!(input.finalScriptSig || input.finalScriptWitness);
}

// Compare by content so a replaced signature counts as new.
function signatureEntries(input: PsbtInput | undefined): Set<string> {
  const entries = new Set<string>();
  input?.partialSig?.forEach(({ pubkey, signature }) =>
    entries.add(`partial:${ccc.hexFrom(pubkey)}:${ccc.hexFrom(signature)}`),
  );
  if (input?.tapKeySig) {
    entries.add(`tapKey:${ccc.hexFrom(input.tapKeySig)}`);
  }
  input?.tapScriptSig?.forEach(({ pubkey, leafHash, signature }) =>
    entries.add(
      `tapScript:${ccc.hexFrom(pubkey)}:${ccc.hexFrom(leafHash)}:${ccc.hexFrom(signature)}`,
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

function finalizeInputs(psbt: Psbt, indexes: Set<number>): ccc.Hex {
  ensureEccLib();
  try {
    for (const index of indexes) {
      psbt.finalizeInput(index);
    }
  } catch (error) {
    throw new Error(
      "Failed to finalize the PSBT signed by JoyID. " +
        "Use { autoFinalized: false } for partial or multisig signing.",
      { cause: error },
    );
  }

  return ccc.hexFrom(psbt.toBuffer());
}

/**
 * Checks that JoyID returned a PSBT of the same transaction.
 */
export function parseSignedPsbt(
  unsignedPsbtHex: ccc.Hex,
  signedPsbtHex: ccc.Hex,
): { unsigned: Psbt; signed: Psbt } {
  if (!signedPsbtHex.startsWith("0x70736274ff")) {
    throw new Error("JoyID did not return a PSBT.");
  }

  const unsigned = Psbt.fromHex(unsignedPsbtHex.slice(2));
  let signed: Psbt;
  try {
    signed = Psbt.fromHex(signedPsbtHex.slice(2));
  } catch (error) {
    throw new Error("JoyID returned an invalid PSBT.", { cause: error });
  }

  if (
    ccc.hexFrom(unsigned.data.getTransaction()) !==
    ccc.hexFrom(signed.data.getTransaction())
  ) {
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
  unsigned: Psbt,
  signed: Psbt,
  inputsToSign: ccc.InputToSign[],
): ccc.Hex {
  const signedIndexes = new Set(
    signed.data.inputs.flatMap((input, index) =>
      !isFinalized(input) && hasNewSignature(unsigned.data.inputs[index], input)
        ? [index]
        : [],
    ),
  );

  if (inputsToSign.length === 0) {
    return finalizeInputs(signed, signedIndexes);
  }

  const requestedIndexes = new Set<number>();
  for (const { index } of inputsToSign) {
    const input = signed.data.inputs[index];
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
