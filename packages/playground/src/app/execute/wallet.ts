import type { ccc } from "@ckb-ccc/connector-react";

export class MissingWalletError extends Error {
  // Classify even arbitrary values thrown by getters without invoking proxy traps.
  #missingWallet = true;
  static is(error: unknown): error is MissingWalletError {
    return (
      typeof error === "object" && error !== null && #missingWallet in error
    );
  }

  constructor() {
    super(
      "This code needs a signer. Connect your wallet or choose the read-only example wallet, then press Run again.",
    );
    this.name = "MissingWalletError";
  }
}

/** The connector may still expose the previous signer during a network switch. */
export function hasSignerNetworkMismatch(
  client: ccc.Client,
  signer: ccc.Signer | undefined,
) {
  return (
    signer !== undefined && signer.client.addressPrefix !== client.addressPrefix
  );
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
