import type { ccc } from "@ckb-ccc/connector-react";

export class MissingWalletError extends Error {
  constructor() {
    super(
      "This code needs a signer. Connect your wallet or choose the read-only example wallet, then press Run again.",
    );
    this.name = "MissingWalletError";
  }
}

/** Creating, importing or destructuring bindings does not use a wallet.
 * The sentinel fails only when executing code actually accesses signer state.
 */
export function createWalletBindings(
  client: ccc.Client,
  signer: ccc.Signer | undefined,
) {
  const missingSigner = new Proxy({} as ccc.Signer, {
    get() {
      throw new MissingWalletError();
    },
    set() {
      throw new MissingWalletError();
    },
  });
  return { client: signer?.client ?? client, signer: signer ?? missingSigner };
}

export type WalletConnectionRequest =
  { opened: true } | { opened: false; message: string };

/** Opening the picker is not successful connection and never resumes a script. */
export async function requestWalletConnection(
  open: () => unknown,
): Promise<WalletConnectionRequest> {
  try {
    await open();
    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      message: `Could not open the wallet connection dialog: ${error instanceof Error ? error.message : String(error)}. You can try again.`,
    };
  }
}
