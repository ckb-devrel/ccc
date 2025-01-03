import { secp256k1 } from "@noble/curves/secp256k1";
import { magicHash } from "bitcoinjs-message";
import { bytesFrom, BytesLike } from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";
import {
  btcEcdsaPublicKeyHash,
  btcPublicKeyFromP2pkhAddress,
} from "../btc/verify.js";

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
        sig
          .recoverPublicKey(
            magicHash(challenge, "\x19Dogecoin Signed Message:\n"),
          )
          .toHex(),
      ),
    )
  );
}
