import { secp256k1 } from "@noble/curves/secp256k1";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { magicHash } from "bitcoinjs-message";
import bs58check from "bs58check";
import { Bytes, BytesLike, bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Hex, hexFrom } from "../../hex/index.js";

/**
 * @public
 */
export function btcEcdsaPublicKeyHash(publicKey: BytesLike): Bytes {
  return ripemd160(sha256(bytesFrom(publicKey)));
}

/**
 * @public
 */
export function btcP2pkhAddressFromPublicKey(
  publicKey: BytesLike,
  network: number,
): string {
  return bs58check.encode(
    bytesConcat([network], btcEcdsaPublicKeyHash(publicKey)),
  );
}

/**
 * @public
 */
export function btcPublicKeyFromP2pkhAddress(address: string): Hex {
  return hexFrom(bs58check.decode(address).slice(1));
}

/**
 * @public
 */
export function verifyMessageBtcEcdsa(
  message: string | BytesLike,
  signature: string,
  publicKey: string,
): boolean {
  const challenge =
    typeof message === "string" ? message : hexFrom(message).slice(2);

  const rawSign = bytesFrom(signature, "base64").slice(1);

  return secp256k1.verify(bytesFrom(rawSign), magicHash(challenge), publicKey);
}
