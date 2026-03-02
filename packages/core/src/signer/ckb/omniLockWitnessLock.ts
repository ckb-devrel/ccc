/**
 * OmniLockWitnessLock molecule table encoding/decoding.
 *
 * table OmniLockWitnessLock {
 *     signature: BytesOpt,
 *     omni_identity: IdentityOpt,
 *     preimage: BytesOpt,
 * }
 *
 * For bridge use (auth modes 0x00-0x06, 0xFC), only the signature field is
 * populated. omni_identity and preimage are None (zero-length).
 */

import { Bytes, bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { numToBytes } from "../../num/index.js";

const NUM_FIELDS = 3;
const HEADER_BYTES = (1 + NUM_FIELDS) * 4; // full_size + 3 offsets = 16

/**
 * Encode a signature into the OmniLockWitnessLock molecule table format.
 *
 * The result is suitable for WitnessArgs.lock when the Omnilock cell uses
 * a signature-based auth mode (secp256k1, Ethereum, Bitcoin, CKB multisig,
 * owner lock, etc.) and does not use the administrator (omni_identity) or
 * preimage fields.
 *
 * @param signature - The raw signature bytes.
 * @returns The encoded OmniLockWitnessLock bytes.
 * @public
 */
export function encodeOmniLockWitnessLock(signature: Bytes): Bytes {
  const fullSize = HEADER_BYTES + 4 + signature.length;
  return bytesFrom(
    bytesConcat(
      numToBytes(fullSize, 4), // full_size
      numToBytes(HEADER_BYTES, 4), // offset[0]: signature starts here
      numToBytes(fullSize, 4), // offset[1]: omni_identity (absent, at end)
      numToBytes(fullSize, 4), // offset[2]: preimage (absent, at end)
      numToBytes(signature.length, 4), // Bytes item count
      signature,
    ),
  );
}

/**
 * Encode a signature into OmniLockWitnessLock and return as Hex.
 *
 * @param signature - The raw signature bytes.
 * @returns The encoded OmniLockWitnessLock hex string.
 * @public
 */
export function encodeOmniLockWitnessLockToHex(signature: Bytes): Hex {
  return hexFrom(encodeOmniLockWitnessLock(signature));
}

/**
 * Decode the signature from an OmniLockWitnessLock molecule table.
 *
 * @param data - The full OmniLockWitnessLock bytes.
 * @returns The decoded signature, or undefined if the signature field is absent.
 * @public
 */
export function decodeOmniLockWitnessLock(data: Bytes): Bytes | undefined {
  if (data.length < HEADER_BYTES) {
    throw new Error("OmniLockWitnessLock: data too short for header");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const fullSize = view.getUint32(0, true);
  if (fullSize !== data.length) {
    throw new Error("OmniLockWitnessLock: full_size mismatch");
  }

  const signatureOffset = view.getUint32(4, true);
  const omniIdentityOffset = view.getUint32(8, true);

  // signature field is present if offset[0] < offset[1]
  if (signatureOffset >= omniIdentityOffset) {
    return undefined;
  }

  const sigBytesCount = view.getUint32(signatureOffset, true);
  const sigStart = signatureOffset + 4;
  if (sigStart + sigBytesCount > data.length) {
    throw new Error("OmniLockWitnessLock: signature exceeds data bounds");
  }

  return data.slice(sigStart, sigStart + sigBytesCount);
}

/**
 * Compute the WitnessArgs.lock byte length for an OmniLockWitnessLock
 * containing a signature of the given length.
 *
 * Used to prepare the witness placeholder before computing sighash_all.
 *
 * @param signatureLength - The raw signature byte length.
 * @returns The total OmniLockWitnessLock byte length.
 * @public
 */
export function omniLockWitnessLockLength(signatureLength: number): number {
  return HEADER_BYTES + 4 + signatureLength;
}
