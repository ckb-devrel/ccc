import { Address } from "../address/index.js";
import { BytesLike } from "../bytes/index.js";
import { Client } from "../client/index.js";
import { SignerBtcPublicKeyReadonly } from "./btc/index.js";
import { SignerCkbPublicKey, SignerCkbScriptReadonly } from "./ckb/index.js";
import { SignerDogeAddressReadonly } from "./doge/index.js";
import { SignerEvmAddressReadonly } from "./evm/index.js";
import { SignerNostrPublicKeyReadonly } from "./nostr/index.js";
import { Signature, Signer, SignerSignType } from "./signer/index.js";

/**
 * Creates a signer from a signature.
 *
 * @param client - The client instance.
 * @param signature - The signature to create the signer from.
 * @param message - The message that was signed.
 * @param addresses - The addresses to check against the signer.
 * @returns The signer if the signature is valid and the addresses match, otherwise undefined.
 * @throws Error if the signature sign type is unknown.
 */
export async function signerFromSignature(
  client: Client,
  signature: Signature,
  message?: string | BytesLike | null,
  ...addresses: (string | string[])[]
): Promise<Signer | undefined> {
  if (
    message != undefined &&
    !(await Signer.verifyMessage(message, signature))
  ) {
    return;
  }

  const signer = await (async () => {
    switch (signature.signType) {
      case SignerSignType.EvmPersonal:
        return new SignerEvmAddressReadonly(client, signature.identity);
      case SignerSignType.BtcEcdsa:
        return new SignerBtcPublicKeyReadonly(client, "", signature.identity);
      case SignerSignType.JoyId: {
        const { address } = JSON.parse(signature.identity) as {
          address: string;
        };
        return new SignerCkbScriptReadonly(
          client,
          (await Address.fromString(address, client)).script,
        );
      }
      case SignerSignType.NostrEvent:
        return new SignerNostrPublicKeyReadonly(client, signature.identity);
      case SignerSignType.CkbSecp256k1:
        return new SignerCkbPublicKey(client, signature.identity);
      case SignerSignType.DogeEcdsa:
        return new SignerDogeAddressReadonly(client, signature.identity);
      case SignerSignType.Unknown:
        throw new Error("Unknown signer sign type");
    }
  })();
  const signerAddresses = await signer.getAddresses();
  if (!addresses.flat().every((addr) => signerAddresses.includes(addr))) {
    return;
  }

  return signer;
}
