import {
  SigningAlg,
  verifyCredential,
  verifySessionKeySignature,
  verifySignature,
} from "@joyid/ckb";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  BytesLike,
  bytesConcat,
  bytesFrom,
  bytesTo,
} from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";

async function verifyBinaryPasskeySignature(
  message: BytesLike,
  signature: string,
  signedMessage: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const payload = bytesFrom(signedMessage, "base64url");
    const clientData = payload.subarray(37);
    const { challenge } = JSON.parse(bytesTo(clientData, "utf8")) as {
      challenge: unknown;
    };
    if (challenge !== bytesTo(message, "base64url")) {
      return false;
    }
    // Verify the original bytes: rewriting clientData would invalidate its signature.
    const signatureBase = bytesConcat(
      payload.subarray(0, 37),
      sha256(clientData),
    );
    if (publicKey.length === 128) {
      return p256.verify(
        bytesFrom(signature, "base64url"),
        signatureBase,
        bytesConcat([4], bytesFrom(publicKey)),
        { format: "der", prehash: true, lowS: false },
      );
    }
    // The SDK's raw RSA/SHA-256 verifier also handles the passkey signature base.
    return verifySessionKeySignature(
      bytesTo(signatureBase, "base64url"),
      signature,
      publicKey,
    );
  } catch {
    return false;
  }
}

/**
 * @public
 */
export async function verifyMessageJoyId(
  message: string | BytesLike,
  signature: string,
  identity: string,
): Promise<boolean> {
  const challenge =
    typeof message === "string" ? message : hexFrom(message).slice(2);
  const { address, publicKey, keyType } = JSON.parse(identity) as {
    address: string;
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
  // @joyid/ckb 1.1.4's native verifier only binds UTF-8 text challenges.
  const alg = publicKey.length === 128 ? SigningAlg.ES256 : SigningAlg.RS256;
  const validSignature =
    isPasskey && typeof message !== "string"
      ? await verifyBinaryPasskeySignature(
          message,
          signed,
          signedMessage,
          publicKey,
        )
      : await verifySignature({
          challenge,
          pubkey: publicKey,
          keyType,
          alg,
          signature: signed,
          // Bind session verification to the caller's challenge.
          message: isPasskey
            ? signedMessage
            : bytesTo(bytesFrom(challenge, "utf8"), "base64url"),
        });
  if (!validSignature) {
    return false;
  }

  // I sincerely hope one day we can get rid of the centralized registry
  const registry = address.startsWith("ckb")
    ? "https://api.joy.id/api/v1/"
    : "https://api.testnet.joyid.dev/api/v1/";
  return verifyCredential(
    { pubkey: publicKey, address, keyType, alg },
    registry,
  );
}
