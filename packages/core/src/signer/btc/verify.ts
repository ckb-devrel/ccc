import { secp256k1 } from "@noble/curves/secp256k1";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import bs58check from "bs58check";
import { Bytes, bytesConcat, bytesFrom, BytesLike } from "../../bytes/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { numFrom, numLeToBytes, NumLike } from "../../num/index.js";

/**
 * Encodes a number into a variable-length byte array according to the Bitcoin protocol.
 * This format is used for encoding lengths of data, such as script lengths.
 *
 * @param len - The number to encode. Can be a NumLike.
 * @returns The encoded length as a Bytes.
 * @public
 */
export function btcVarLengthBytesFrom(len: NumLike): Bytes {
  const num = numFrom(len);

  return num < 0xfd
    ? numLeToBytes(num, 1)
    : num <= 0xffff
      ? bytesConcat([0xfd], numLeToBytes(num, 2))
      : num <= 0xffffffff
        ? bytesConcat([0xfe], numLeToBytes(num, 4))
        : bytesConcat([0xff], numLeToBytes(num, 8));
}

/**
 * Computes the message hash for Bitcoin ECDSA signatures.
 * This function follows the Bitcoin message signing standard, which involves
 * prefixing the message with a magic string and its length, then double SHA256 hashing the result.
 *
 * @param message - The message to be hashed. Can be a string or BytesLike.
 * @param messagePrefix - Optional. A custom prefix to use instead of the default "\u0018Bitcoin Signed Message:\n".
 * @returns The Bitcoin hash of the prefixed message as Bytes.
 * @public
 */
export function messageHashBtcEcdsa(
  message: string | BytesLike,
  messagePrefix?: string | BytesLike,
): Bytes {
  const prefix = messagePrefix ?? "\u0018Bitcoin Signed Message:\n";
  const rawPrefix: Bytes =
    typeof prefix === "string" ? bytesFrom(prefix, "utf8") : bytesFrom(prefix);
  const rawMsg: Bytes =
    typeof message === "string"
      ? bytesFrom(message, "utf8")
      : bytesFrom(message);

  return sha256(
    sha256(
      bytesConcat(rawPrefix, btcVarLengthBytesFrom(rawMsg.length), rawMsg),
    ),
  );
}

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

  return secp256k1.verify(
    bytesFrom(rawSign),
    messageHashBtcEcdsa(challenge),
    bytesFrom(publicKey),
  );
}
