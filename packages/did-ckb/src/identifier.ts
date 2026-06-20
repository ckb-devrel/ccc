import { ccc } from "@ckb-ccc/core";

const DID_PREFIX = "did:ckb:";
const ARGS_LEN_BYTES = 20;
const DID_BODY_LEN = 32;

// RFC 4648 base32, lowercase, no padding (WIP-01 §2.2.3).
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const REVERSE = (() => {
  const map: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    map[ALPHABET[i]] = i;
  }
  return map;
})();

export function base32Encode(bytes: ccc.BytesLike): string {
  const buf = ccc.bytesFrom(bytes);
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): ccc.Bytes {
  const cleaned = input.toLowerCase().replace(/=+$/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of cleaned) {
    const v = REVERSE[char];
    if (v === undefined) {
      throw new Error(`Invalid base32 character "${char}" in input`);
    }
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(output);
}

/**
 * Convert 20-byte Type ID args (the `id` returned from `createDidCkb`) to a
 * `did:ckb:` identifier string per WIP-01 §2.2.
 */
export function argsToDid(args: ccc.HexLike): string {
  const bytes = ccc.bytesFrom(args);
  if (bytes.length !== ARGS_LEN_BYTES) {
    throw new Error(
      `did:ckb args must be ${ARGS_LEN_BYTES} bytes, got ${bytes.length}`,
    );
  }
  return DID_PREFIX + base32Encode(bytes);
}

/**
 * Reverse of `argsToDid`. Validates the prefix, base32 length, and decoded
 * byte count.
 */
export function didToArgs(did: string): ccc.Hex {
  if (!did.startsWith(DID_PREFIX)) {
    throw new Error(`Expected did:ckb:..., got "${did}"`);
  }
  const body = did.slice(DID_PREFIX.length);
  // 20 bytes encode to exactly 32 base32 chars without padding. Any other
  // length silently truncates leftover bits, so reject it up front.
  if (body.length !== DID_BODY_LEN) {
    throw new Error(
      `did:ckb identifier must be ${DID_BODY_LEN} base32 chars, got ${body.length}`,
    );
  }
  const bytes = base32Decode(body);
  if (bytes.length !== ARGS_LEN_BYTES) {
    throw new Error(
      `did:ckb identifier must decode to ${ARGS_LEN_BYTES} bytes, got ${bytes.length}`,
    );
  }
  return ccc.hexFrom(bytes);
}

export function isDidCkb(value: string): boolean {
  if (!value.startsWith(DID_PREFIX)) {
    return false;
  }
  try {
    didToArgs(value);
    return true;
  } catch {
    return false;
  }
}
