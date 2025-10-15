export * from "./btc/index.js";
export * from "./ckb/index.js";
export * from "./doge/index.js";
export * from "./dummy/index.js";
export * from "./evm/index.js";
export * from "./nostr/index.js";
export * from "./signer/index.js";
export * from "./signerFromSignature.js";

import { BytesLike } from "../bytes/index.js";
import { Client } from "../client/index.js";
import { Signer as BaseSigner, Signature } from "./signer/index.js";
import { signerFromSignature } from "./signerFromSignature.js";

export abstract class Signer extends BaseSigner {
  static fromSignature(
    client: Client,
    signature: Signature,
    message?: string | BytesLike | null,
    ...addresses: (string | string[])[]
  ): Promise<Signer | undefined> {
    return signerFromSignature(client, signature, message, ...addresses);
  }
}
