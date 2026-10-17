import {
  WalletPsbt,
  hasNewSignature,
  isFinalized,
  parseAndValidateSignedPsbt,
} from "@ckb-ccc/btc-psbt";
import { ccc } from "@ckb-ccc/core";

type PsbtInput = ReturnType<WalletPsbt["getInput"]>;
function inputsOf(tx: WalletPsbt): PsbtInput[] {
  return Array.from({ length: tx.inputsLength }, (_, i) => tx.getInput(i));
}

function finalizeInputs(tx: WalletPsbt, indexes: Set<number>): ccc.Hex {
  try {
    for (const index of indexes) {
      tx.finalizeInput(index);
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
  inputsToSign: ccc.InputToSign[] = [],
): { unsigned: WalletPsbt; signed: WalletPsbt } {
  return parseAndValidateSignedPsbt(
    unsignedPsbtHex,
    signedPsbtHex,
    inputsToSign,
    "JoyID",
  );
}

/**
 * Finalizes the inputs JoyID signed. Inputs signed only by others are skipped,
 * and every requested input must be signed by JoyID.
 *
 * Inputs that already had a JoyID signature are not supported, as re-signing
 * produces the same bytes.
 */
export function finalizeSignedInputs(
  unsigned: WalletPsbt,
  signed: WalletPsbt,
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
