import { secp256k1 } from "@noble/curves/secp256k1";
import { BytesLike, bytesFrom } from "../../bytes/index.js";
import { hashCkb } from "../../hasher/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { numFrom } from "../../num/index.js";

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
  const signatureBytes = bytesFrom(signature);
  return secp256k1.verify(
    new secp256k1.Signature(
      numFrom(signatureBytes.slice(0, 32)),
      numFrom(signatureBytes.slice(32, 64)),
    )
      .addRecoveryBit(Number(numFrom(signatureBytes.slice(64, 65))))
      .toBytes(),
    bytesFrom(messageHashCkbSecp256k1(message)),
    bytesFrom(publicKey),
  );
}
