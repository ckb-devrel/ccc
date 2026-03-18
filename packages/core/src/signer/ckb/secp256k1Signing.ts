import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesConcat, bytesFrom, BytesLike } from "../../bytes/index.js";
import { hashCkb } from "../../hasher/index.js";
import { Hex, hexFrom } from "../../hex/index.js";

export const SECP256K1_SIGNATURE_LENGTH = 65;

/**
 * Sign a message using Secp256k1.
 *
 * @param message - The message to sign.
 * @param privateKey - The private key.
 * @returns The signature.
 * @public
 */
export function signMessageSecp256k1(
  message: BytesLike,
  privateKey: BytesLike,
): Hex {
  const signature = secp256k1.sign(bytesFrom(message), bytesFrom(privateKey), {
    format: "recovered",
    prehash: false,
  });
  return hexFrom(bytesConcat(signature.slice(1), signature.slice(0, 1)));
}

/**
 * Verify a message using Secp256k1.
 *
 * @param message - The message to verify.
 * @param signature - The signature.
 * @param publicKey - The public key.
 * @returns True if the signature is valid, false otherwise.
 * @public
 */
export function verifyMessageSecp256k1(
  message: BytesLike,
  signature: BytesLike,
  publicKey: BytesLike,
): boolean {
  const signatureBytes = bytesFrom(signature);
  return secp256k1.verify(
    bytesConcat(signatureBytes.slice(64), signatureBytes.slice(0, 64)),
    bytesFrom(message),
    bytesFrom(publicKey),
    { format: "recovered", prehash: false },
  );
}

/**
 * Recover the public key from a Secp256k1 signature.
 *
 * @param message - The message.
 * @param signature - The signature.
 * @returns The recovered public key.
 * @public
 */
export function recoverMessageSecp256k1(
  message: BytesLike,
  signature: BytesLike,
): Hex {
  const signatureBytes = bytesFrom(signature);
  return hexFrom(
    secp256k1.recoverPublicKey(
      bytesConcat(signatureBytes.slice(64), signatureBytes.slice(0, 64)),
      bytesFrom(message),
      { prehash: false },
    ),
  );
}

/**
 * @public
 */
export function messageHashCkbSecp256k1(message: string | BytesLike): Hex {
  const msg = typeof message === "string" ? message : hexFrom(message);
  const buffer = bytesFrom(`Nervos Message:${msg}`, "utf8");
  return hashCkb(buffer);
}

/**
 * @public
 */
export function verifyMessageCkbSecp256k1(
  message: string | BytesLike,
  signature: string,
  publicKey: string,
): boolean {
  return verifyMessageSecp256k1(
    messageHashCkbSecp256k1(message),
    signature,
    publicKey,
  );
}
