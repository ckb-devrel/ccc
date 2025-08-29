import { secp256k1 } from "@noble/curves/secp256k1";
import { Bytes, bytesFrom, BytesLike } from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";
import {
  btcEcdsaPublicKeyHash,
  btcPublicKeyFromP2pkhAddress,
  messageHashBtcEcdsa,
} from "../btc/verify.js";

/**
 * Computes the message hash for Dogecoin ECDSA signatures.
 * This function follows the Dogecoin message signing standard, which involves
 * prefixing the message with a magic string and its length, then double SHA256 hashing the result.
 *
 * @param message - The message to be hashed. Can be a string or BytesLike.
 * @param messagePrefix - Optional. A custom prefix to use instead of the default "\x19Dogecoin Signed Message:\n".
 * @returns The Dogecoin hash of the prefixed message as Bytes.
 * @public
 */
export function messageHashDogeEcdsa(
  message: string | BytesLike,
  messagePrefix?: string | BytesLike,
): Bytes {
  return messageHashBtcEcdsa(
    message,
    messagePrefix ?? "\x19Dogecoin Signed Message:\n",
  );
}

/**
 * @public
 */
export function verifyMessageDogeEcdsa(
  message: string | BytesLike,
  signature: string,
  address: string,
): boolean {
  const challenge =
    typeof message === "string" ? message : hexFrom(message).slice(2);
  const signatureBytes = bytesFrom(signature, "base64");
  const recoveryBit = signatureBytes[0];
  const rawSign = signatureBytes.slice(1);

  const sig = secp256k1.Signature.fromCompact(
    hexFrom(rawSign).slice(2),
  ).addRecoveryBit(recoveryBit - 31);

  return (
    btcPublicKeyFromP2pkhAddress(address) ===
    hexFrom(
      btcEcdsaPublicKeyHash(
        sig.recoverPublicKey(messageHashDogeEcdsa(challenge)).toHex(),
      ),
    )
  );
}
