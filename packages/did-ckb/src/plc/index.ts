import { ccc } from "@ckb-ccc/core";
import { p256 } from "@noble/curves/p256";
import { secp256k1 } from "@noble/curves/secp256k1";

/**
 * Minimal did:plc helpers, scoped to what a did:ckb migration needs:
 * fetch the op log from the public PLC directory, parse rotation keys, and
 * sign a 32-byte CKB transaction hash with a rotation private key.
 *
 * The on-chain contract is happy with a history of length 1 (WIP-02 §3.1.1
 * RECOMMENDs the genesis-only form), so we don't walk the full op chain
 * client-side.
 */

const PLC_DIRECTORY = "https://plc.directory";

export type Curve = "secp256k1" | "p256";

export type PlcRotationKey = {
  didKey: string;
  curve: Curve;
  compressedPubkey: ccc.Bytes;
};

export type PlcOperation = {
  type: string;
  rotationKeys?: string[];
  verificationMethods?: Record<string, string>;
  alsoKnownAs?: string[];
  services?: Record<string, { type: string; endpoint: string }>;
  prev: string | null;
  sig: string;
  // Legacy `create` op fields:
  signingKey?: string;
  recoveryKey?: string;
  handle?: string;
  service?: string;
  [key: string]: unknown;
};

/**
 * Fetch the operation log for a did:plc identifier from the public directory.
 * Pass a custom directory URL when targeting a staging environment.
 */
export async function fetchPlcLog(
  did: string,
  directory: string = PLC_DIRECTORY,
): Promise<PlcOperation[]> {
  if (!did.startsWith("did:plc:")) {
    throw new Error(`Expected did:plc identifier, got "${did}"`);
  }
  const res = await fetch(`${directory}/${did}/log`);
  if (!res.ok) {
    throw new Error(`PLC log fetch failed (${res.status} ${res.statusText})`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("PLC log empty or malformed");
  }
  return data as PlcOperation[];
}

export function getGenesisOperation(log: PlcOperation[]): PlcOperation {
  if (log.length === 0) {
    throw new Error("Empty PLC log");
  }
  return log[0];
}

/**
 * Surface the rotation keys declared in a genesis op as a uniform list. PLC
 * genesis comes in two shapes: the modern `plc_operation` (with
 * `rotationKeys`) and the deprecated `create` (with `signingKey` +
 * `recoveryKey`). The on-chain contract treats the legacy form as
 * `[signingKey, recoveryKey]`, so we expose the same order.
 */
export function getRotationKeys(op: PlcOperation): PlcRotationKey[] {
  const keys: string[] = [];
  if (op.rotationKeys?.length) {
    keys.push(...op.rotationKeys);
  } else if (op.signingKey || op.recoveryKey) {
    if (op.signingKey) {
      keys.push(op.signingKey);
    }
    if (op.recoveryKey) {
      keys.push(op.recoveryKey);
    }
  }
  return keys.map((didKey) => {
    const parsed = parseDidKey(didKey);
    return {
      didKey,
      curve: parsed.curve,
      compressedPubkey: parsed.compressedPubkey,
    };
  });
}

export function parseDidKey(didKey: string): {
  curve: Curve;
  compressedPubkey: ccc.Bytes;
} {
  if (!didKey.startsWith("did:key:z")) {
    throw new Error(`Expected did:key:z..., got "${didKey}"`);
  }
  const raw = base58btcDecode(didKey.slice("did:key:z".length));
  if (raw.length !== 35) {
    throw new Error(
      `did:key payload must be 35 bytes (2-byte multicodec tag + 33-byte compressed pubkey), got ${raw.length}`,
    );
  }
  const tag1 = raw[0];
  const tag2 = raw[1];
  let curve: Curve;
  if (tag1 === 0xe7 && tag2 === 0x01) {
    curve = "secp256k1";
  } else if (tag1 === 0x80 && tag2 === 0x24) {
    curve = "p256";
  } else {
    throw new Error(
      `Unrecognised did:key multicodec tag: 0x${tag1.toString(16).padStart(2, "0")} 0x${tag2.toString(16).padStart(2, "0")}`,
    );
  }
  return { curve, compressedPubkey: raw.slice(2) };
}

/**
 * Sign a 32-byte CKB tx hash with a PLC rotation private key.
 *
 * The on-chain validator runs k256/p256's `Verifier::verify` which internally
 * SHA-256 hashes the message before checking the ECDSA signature. Noble's
 * default is the opposite (treat input as already-hashed), so we pass
 * `prehash: true` to make noble apply SHA-256 internally and match the
 * contract. Output is canonical low-s 64-byte compact form, identical to
 * what @atproto/crypto's Keypair.sign produces.
 */
export function signRotationHash(
  privateKey: ccc.BytesLike,
  txHash: ccc.BytesLike,
  curve: Curve,
): ccc.Bytes {
  const hash = ccc.bytesFrom(txHash);
  if (hash.length !== 32) {
    throw new Error(`Expected 32-byte tx hash, got ${hash.length}`);
  }
  const priv = ccc.bytesFrom(privateKey);
  if (priv.length !== 32) {
    throw new Error(`Expected 32-byte private key, got ${priv.length}`);
  }
  if (curve === "secp256k1") {
    return secp256k1
      .sign(hash, priv, { prehash: true, lowS: true })
      .toCompactRawBytes();
  }
  return p256
    .sign(hash, priv, { prehash: true, lowS: true })
    .toCompactRawBytes();
}

/**
 * Quick sanity check: derive the public key from `privateKey` and compare
 * against `expectedPubkey`. Lets a UI tell the user "wrong key for this
 * rotation slot" without waiting for an on-chain rejection.
 */
export function verifyPrivateKeyMatch(
  privateKey: ccc.BytesLike,
  expectedPubkey: ccc.BytesLike,
  curve: Curve,
): boolean {
  const priv = ccc.bytesFrom(privateKey);
  if (priv.length !== 32) {
    return false;
  }
  const expected = ccc.bytesFrom(expectedPubkey);
  const pub =
    curve === "secp256k1"
      ? secp256k1.getPublicKey(priv, true)
      : p256.getPublicKey(priv, true);
  if (pub.length !== expected.length) {
    return false;
  }
  for (let i = 0; i < pub.length; i++) {
    if (pub[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

// Inline base58btc decode (Bitcoin alphabet) so we don't pull in multiformats
// as a direct dependency. Audited by the multicodec tag round-trip tests.
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_REVERSE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    m[BASE58_ALPHABET[i]] = i;
  }
  return m;
})();

function base58btcDecode(input: string): ccc.Bytes {
  if (input.length === 0) {
    return new Uint8Array(0);
  }
  let leadingOnes = 0;
  while (leadingOnes < input.length && input[leadingOnes] === "1") {
    leadingOnes++;
  }
  let value = 0n;
  for (let i = leadingOnes; i < input.length; i++) {
    const c = input[i];
    const v = BASE58_REVERSE[c];
    if (v === undefined) {
      throw new Error(`Invalid base58 character "${c}"`);
    }
    value = value * 58n + BigInt(v);
  }
  const tail: number[] = [];
  while (value > 0n) {
    tail.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  return Uint8Array.from([...Array<number>(leadingOnes).fill(0), ...tail]);
}
