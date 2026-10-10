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
    keyType: "main_key" | "sub_key" | "main_session_key" | "sub_session_key";
  };
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
    // @joyid/ckb checks any other key only over `message`, and a session key
    // signs the challenge itself
    message: isPasskey
      ? signedMessage
      : bytesTo(bytesFrom(challenge, "utf8"), "base64url"),
  });
}
