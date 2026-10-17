import { SigningAlg, verifySignature } from "@joyid/ckb";
import { BytesLike, bytesFrom, bytesTo } from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";

/**
 * @public
 */
export function verifyMessageJoyId(
  message: string | BytesLike,
  signature: string,
  identity: string,
): Promise<boolean> {
  const challenge =
    typeof message === "string" ? message : hexFrom(message).slice(2);
  const { publicKey, keyType } = JSON.parse(identity) as {
    publicKey: string;
    keyType: unknown;
  };
  if (
    keyType !== "main_key" &&
    keyType !== "sub_key" &&
    keyType !== "main_session_key" &&
    keyType !== "sub_session_key"
  ) {
    return Promise.resolve(false);
  }
  // Only what the JoyID signer writes: the key and the challenge come from the caller
  const { signature: signed, message: signedMessage } = JSON.parse(
    signature,
  ) as { signature: string; message: string };
  const isPasskey = keyType === "main_key" || keyType === "sub_key";

  return verifySignature({
    challenge,
    pubkey: publicKey,
    keyType,
    // A P-256 public key is 64 bytes, an RSA one 260
    alg: publicKey.length === 128 ? SigningAlg.ES256 : SigningAlg.RS256,
    signature: signed,
    // Bind session verification to the caller's challenge rather than the
    // message supplied in the signature response.
    message: isPasskey
      ? signedMessage
      : bytesTo(bytesFrom(challenge, "utf8"), "base64url"),
  });
}
