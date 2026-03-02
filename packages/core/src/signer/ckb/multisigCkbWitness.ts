import { Bytes, bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Since, SinceLike } from "../../ckb/index.js";
import { codec, Entity } from "../../codec/index.js";
import { HASH_CKB_SHORT_LENGTH, hashCkb } from "../../hasher/index.js";
import { Hex, hexFrom, HexLike } from "../../hex/index.js";
import { numFrom, NumLike, numToBytes } from "../../num/index.js";
import { SECP256K1_SIGNATURE_LENGTH } from "./secp256k1Signing.js";

export type MultisigCkbWitnessLike = (
  | {
      publicKeyHashes: HexLike[];
      publicKeys?: undefined | null;
    }
  | {
      publicKeyHashes?: undefined | null;
      publicKeys: HexLike[];
    }
) & {
  threshold: NumLike;
  mustMatch?: NumLike | null;
  signatures?: HexLike[] | null;
};

/**
 * A class representing multisig information, holding information ingredients and containing utilities.
 * @public
 */
@codec({
  encode: (encodable: MultisigCkbWitness) => {
    const { publicKeyHashes, threshold, mustMatch, signatures } =
      MultisigCkbWitness.from(encodable);

    if (
      signatures.some((s) => s.length !== SECP256K1_SIGNATURE_LENGTH * 2 + 2)
    ) {
      throw Error("MultisigCkbWitness: invalid signature length");
    }
    if (
      publicKeyHashes.some((s) => s.length !== HASH_CKB_SHORT_LENGTH * 2 + 2)
    ) {
      throw Error("MultisigCkbWitness: invalid public key hash length");
    }

    return bytesConcat(
      "0x00",
      numToBytes(mustMatch ?? 0),
      numToBytes(threshold),
      numToBytes(publicKeyHashes.length),
      ...publicKeyHashes,
      ...signatures,
    );
  },
  decode: (raw: Bytes) => {
    const [
      _reserved,
      mustMatch,
      threshold,
      publicKeyHashesLength,
      ...rawKeyAndSignatures
    ] = raw;

    if (
      rawKeyAndSignatures.length <
      publicKeyHashesLength * HASH_CKB_SHORT_LENGTH
    ) {
      throw Error("MultisigCkbWitness: invalid public key hashes length");
    }

    const signatures = rawKeyAndSignatures.slice(
      publicKeyHashesLength * HASH_CKB_SHORT_LENGTH,
    );

    return MultisigCkbWitness.from({
      publicKeyHashes: Array.from(new Array(publicKeyHashesLength), (_, i) =>
        hexFrom(
          rawKeyAndSignatures.slice(
            i * HASH_CKB_SHORT_LENGTH,
            (i + 1) * HASH_CKB_SHORT_LENGTH,
          ),
        ),
      ),
      threshold: numFrom(threshold),
      mustMatch: numFrom(mustMatch),
      signatures: Array.from(
        new Array(Math.floor(signatures.length / SECP256K1_SIGNATURE_LENGTH)),
        (_, i) =>
          hexFrom(
            signatures.slice(
              i * SECP256K1_SIGNATURE_LENGTH,
              (i + 1) * SECP256K1_SIGNATURE_LENGTH,
            ),
          ),
      ),
    });
  },
})
export class MultisigCkbWitness extends Entity.Base<
  MultisigCkbWitnessLike,
  MultisigCkbWitness
>() {
  /**
   * @param publicKeyHashes - The public key hashes.
   * @param threshold - The threshold.
   * @param mustMatch - The number of signatures that must match.
   * @param signatures - The signatures.
   */
  constructor(
    public publicKeyHashes: Hex[],
    public threshold: number,
    public mustMatch: number,
    public signatures: Hex[],
  ) {
    super();

    const keysLength = publicKeyHashes.length;

    if (threshold <= 0 || threshold > keysLength) {
      throw new Error(
        "threshold should be in range from 1 to public keys length",
      );
    }
    if (mustMatch < 0 || mustMatch > Math.min(keysLength, threshold)) {
      throw new Error(
        "mustMatch should be in range from 0 to min(public keys length, threshold)",
      );
    }
    if (keysLength > 255) {
      throw new Error("public keys length should be less than 256");
    }
  }

  /**
   * Create a MultisigCkbWitness from a MultisigCkbWitnessLike.
   *
   * @param witness - The witness like object.
   * @returns The MultisigCkbWitness.
   */
  static from(witness: MultisigCkbWitnessLike): MultisigCkbWitness {
    const publicKeyHashes = (() => {
      if (witness.publicKeyHashes) {
        return witness.publicKeyHashes;
      }
      return witness.publicKeys.map((k) => hashCkb(k).slice(0, 42));
    })();

    return new MultisigCkbWitness(
      publicKeyHashes.map(hexFrom),
      Number(numFrom(witness.threshold)),
      Number(numFrom(witness.mustMatch ?? 0)),
      witness.signatures?.map(hexFrom) ?? [],
    );
  }

  /**
   * Get the script args of the multisig script.
   *
   * @param since - The since value.
   * @returns The script args.
   */
  scriptArgs(since?: SinceLike | null): Bytes {
    const hash = hashCkb(this.toBytes()).slice(0, 42);

    if (since != null) {
      return bytesConcat(hash, Since.from(since).toBytes());
    }

    return bytesFrom(hash);
  }

  /**
   * Check if the multisig info is equal to another.
   *
   * @param otherLike - The other multisig info.
   * @returns True if the multisig info is equal, false otherwise.
   */
  eqInfo(otherLike: MultisigCkbWitnessLike): boolean {
    const other = MultisigCkbWitness.from(otherLike);
    return (
      this.publicKeyHashes.length === other.publicKeyHashes.length &&
      this.publicKeyHashes.every((h, i) => h === other.publicKeyHashes[i]) &&
      this.threshold === other.threshold &&
      this.mustMatch === other.mustMatch
    );
  }
}
