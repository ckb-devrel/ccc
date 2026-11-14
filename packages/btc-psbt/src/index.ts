import { secp256k1 } from "@noble/curves/secp256k1.js";
import { OutScript, Transaction, type TxOpts } from "@scure/btc-signer";
import { tapLeafHash } from "@scure/btc-signer/payment.js";
import { getPrevOut } from "@scure/btc-signer/transaction.js";
import { equalBytes, hash160 } from "@scure/btc-signer/utils.js";

export const PSBT_OPTIONS: Readonly<TxOpts> = {
  unknown: "ignore",
  proprietary: "ignore",
};
type Input = ReturnType<Transaction["getInput"]>;

export function isFinalized(input: Input): boolean {
  return !!(input.finalScriptSig?.length || input.finalScriptWitness?.length);
}

/** Match the signatures scure's built-in finalizer will use, without constructing a witness. */
function isReady(input: Input): boolean {
  if (isFinalized(input) || (!input.witnessUtxo && !input.nonWitnessUtxo)) {
    return false;
  }
  let script = OutScript.decode(getPrevOut(input).script);
  if (script.type === "tr") {
    if (input.tapKeySig?.length) {
      return true;
    }
    return (
      input.tapLeafScript?.some(([, leaf]) => {
        const code = leaf.subarray(0, -1);
        const template = OutScript.decode(code);
        if (template.type !== "tr_ms" && template.type !== "tr_ns") {
          return false;
        }
        const hash = tapLeafHash(code, leaf[leaf.length - 1]);
        const count = template.pubkeys.filter((pub) =>
          input.tapScriptSig?.some(
            ([key, signature]) =>
              signature.length &&
              equalBytes(key.pubKey, pub) &&
              equalBytes(key.leafHash, hash),
          ),
        ).length;
        return (
          count >=
          (template.type === "tr_ms" ? template.m : template.pubkeys.length)
        );
      }) ?? false
    );
  }
  if (script.type === "sh") {
    if (!input.redeemScript) {
      return false;
    }
    script = OutScript.decode(input.redeemScript);
  }
  const segwit = script.type === "wpkh" || script.type === "wsh";
  if (script.type === "wsh") {
    if (!input.witnessScript) {
      return false;
    }
    script = OutScript.decode(input.witnessScript);
  }
  if (!segwit && !input.nonWitnessUtxo) {
    return false;
  }
  const signature = input.partialSig?.[0];
  switch (script.type) {
    case "pkh":
    case "wpkh":
      return (
        !!signature?.[1].length &&
        equalBytes(hash160(signature[0]), script.hash)
      );
    case "pk":
      return (
        !!signature?.[1].length &&
        secp256k1.Point.fromBytes(signature[0]).equals(
          secp256k1.Point.fromBytes(script.pubkey),
        )
      );
    case "ms":
      return (
        script.pubkeys.filter((pub) =>
          input.partialSig?.some(
            ([key, sig]) => sig.length && equalBytes(key, pub),
          ),
        ).length >= script.m
      );
    default:
      return false;
  }
}

/** Parse a complete wallet PSBT using stock scure. */
export function parsePsbt(bytes: Uint8Array): Transaction {
  return Transaction.fromPSBT(bytes, PSBT_OPTIONS);
}

/** Finalize ready inputs in the original transaction; preserve incomplete inputs. */
export function finalizeReadyInputs(tx: Transaction): void {
  for (let index = 0; index < tx.inputsLength; index++) {
    if (!isReady(tx.getInput(index))) {
      continue;
    }
    try {
      tx.finalizeIdx(index);
    } catch (error) {
      throw new Error(`Failed to finalize PSBT input #${index}.`, {
        cause: error,
      });
    }
  }
}
