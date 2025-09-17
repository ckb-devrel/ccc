import {
  CredentialKeyType,
  SigningAlg,
  verifyCredential,
  verifySignature,
} from "@joyid/ckb";
import { BytesLike } from "../../bytes/index.js";
import { hexFrom } from "../../hex/index.js";

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
    keyType: CredentialKeyType;
  };
  const signatureObj = JSON.parse(signature) as {
    alg: SigningAlg;
    signature: string;
    message: string;
  };

  if (
    !(await verifySignature({
      challenge,
      pubkey: publicKey,
      keyType,
      ...signatureObj,
    }))
  ) {
    return false;
  }

  // I sincerely hope one day we can get rid of the centralized registry
  const registry = address.startsWith("ckb")
    ? "https://api.joy.id/api/v1/"
    : "https://api.testnet.joyid.dev/api/v1/";
  return verifyCredential(
    {
      pubkey: publicKey,
      address,
      keyType,
      alg: signatureObj.alg,
    },
    registry,
  );
}
