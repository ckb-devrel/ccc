import { AddressType, getAddressType } from "../address.js";
import { TxInputData, TxOutput } from "./transaction.js";

export const DEFAULT_VIRTUAL_SIZE_BUFFER = 20;

/**
 * Stateless fee estimator for Bitcoin transactions.
 * Estimates virtual size based on input/output address types
 * without requiring actual signing.
 */
export class BtcFeeEstimator {
  /**
   * Estimate virtual size of a transaction
   * Based on Bitcoin transaction structure and different address types
   */
  estimateVirtualSize(inputs: TxInputData[], outputs: TxOutput[]): number {
    // Base transaction size (version + locktime + input count + output count)
    let baseSize =
      4 + 4 + getVarIntSize(inputs.length) + getVarIntSize(outputs.length);

    // Calculate input sizes
    let witnessSize = 0;
    for (const input of inputs) {
      // Each input: txid (32) + vout (4) + scriptSig length + scriptSig + sequence (4)
      baseSize += 32 + 4 + 4; // txid + vout + sequence

      // Determine address type from the input
      const addressType = getInputAddressType(input);

      switch (addressType) {
        case "P2WPKH":
          // P2WPKH: scriptSig is empty, witness has 2 items (signature + pubkey)
          baseSize += 1; // empty scriptSig
          witnessSize += 1 + 1 + 72 + 1 + 33; // witness stack count + sig length + sig + pubkey length + pubkey
          break;
        case "P2TR":
          // P2TR: scriptSig is empty, witness has 1 item (signature)
          baseSize += 1; // empty scriptSig
          witnessSize += 1 + 1 + 64; // witness stack count + sig length + sig
          break;
        case "P2PKH":
          // P2PKH: scriptSig has signature + pubkey, no witness
          baseSize += 1 + 72 + 33; // scriptSig length + sig + pubkey
          break;
        default:
          // Default estimation for unknown types
          baseSize += 1 + 107; // average scriptSig size
          break;
      }
    }

    // Calculate output sizes
    for (const output of outputs) {
      // Each output: value (8) + scriptPubKey length + scriptPubKey
      baseSize += 8; // value

      if ("address" in output && output.address) {
        const addressType = getAddressType(output.address);
        switch (addressType) {
          case AddressType.P2WPKH:
            baseSize += 1 + 22; // length + scriptPubKey
            break;
          case AddressType.P2TR:
            baseSize += 1 + 34; // length + scriptPubKey
            break;
          case AddressType.P2PKH:
            baseSize += 1 + 25; // length + scriptPubKey
            break;
          default:
            baseSize += 1 + 25; // default size
            break;
        }
      } else if ("script" in output && output.script) {
        // For script outputs, use the actual script length
        baseSize += getVarIntSize(output.script.length) + output.script.length;
      } else {
        // Default for unknown output types
        baseSize += 1 + 25;
      }
    }

    // Add witness header if there are witness inputs
    if (witnessSize > 0) {
      witnessSize += 2; // witness marker + flag
    }

    // Calculate weight: base_size * 4 + witness_size
    const weight = baseSize * 4 + witnessSize;

    // Virtual size is weight / 4, rounded up
    return Math.ceil(weight / 4);
  }
}

/**
 * Get the size of a variable integer encoding
 */
export function getVarIntSize(value: number): number {
  if (value < 0xfd) return 1;
  if (value <= 0xffff) return 3;
  if (value <= 0xffffffff) return 5;
  return 9;
}

/**
 * Determine address type from PSBT input data
 */
export function getInputAddressType(input: TxInputData): string {
  // Check if it's a Taproot input
  if (input.tapInternalKey) {
    return "P2TR";
  }

  // Check if it has witness data (P2WPKH or P2WSH)
  if (input.witnessUtxo) {
    const script = input.witnessUtxo.script;
    if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) {
      return "P2WPKH";
    }
    if (script.length === 34 && script[0] === 0x00 && script[1] === 0x20) {
      return "P2WSH";
    }
  }

  // Default to P2PKH for legacy inputs
  return "P2PKH";
}
