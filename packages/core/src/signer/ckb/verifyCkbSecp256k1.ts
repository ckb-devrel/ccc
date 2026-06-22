import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesConcat, bytesFrom, BytesLike } from "../../bytes/index.js";
import { hashCkb } from "../../hasher/index.js";
import { Hex, hexFrom } from "../../hex/index.js";

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
  const raw = bytesFrom(signature);

  return secp256k1.verify(
    bytesConcat(raw.slice(64), raw.slice(0, 64)),
    bytesFrom(messageHashCkbSecp256k1(message)),
    bytesFrom(publicKey),
    { format: "recovered", prehash: false },
  );
}
