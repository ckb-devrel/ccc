import { ccc } from "@ckb-ccc/ccc";

// The original Playground example identity. Public key only; no signing secret.
export const EXAMPLE_PUBLIC_KEY =
  "0x026f3255791f578cc5e38783b6f2d87d4709697b797def6bf7b3b9af4120e2bfd9";

export class ExampleWalletReadOnlyError extends Error {
  constructor() {
    super(
      "The example wallet is read-only. Connect your own wallet to sign or send, then review your code and press Run again.",
    );
    this.name = "ExampleWalletReadOnlyError";
  }
}

/** Explicit opt-in to the original example address, never a signing wallet. */
export class ExampleWallet extends ccc.SignerCkbPublicKey {
  constructor(client: ccc.Client) {
    super(client, EXAMPLE_PUBLIC_KEY);
  }

  override async signMessageRaw(
    _message: string | ccc.BytesLike,
  ): Promise<string> {
    throw new ExampleWalletReadOnlyError();
  }

  override async signTransaction(
    _tx: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    throw new ExampleWalletReadOnlyError();
  }

  override async signOnlyTransaction(
    _tx: ccc.TransactionLike,
  ): Promise<ccc.Transaction> {
    throw new ExampleWalletReadOnlyError();
  }

  override async sendTransaction(_tx: ccc.TransactionLike): Promise<ccc.Hex> {
    throw new ExampleWalletReadOnlyError();
  }
}
