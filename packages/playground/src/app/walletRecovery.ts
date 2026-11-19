import { MissingWalletError } from "./execute/wallet";

/** A historical connection event, not a successful execution result. */
export class WalletReadyMessage {
  constructor(
    readonly failure: MissingWalletError,
    readonly example: boolean,
  ) {}
}

type WalletMode = "example" | "real" | undefined;

/** Emit once per connection or wallet-mode change, not on client refreshes. */
export function createWalletRecoveryTracker() {
  let previousFailure: MissingWalletError | undefined;
  let previousMode: WalletMode;
  return (failure: MissingWalletError | undefined, mode: WalletMode) => {
    const emit =
      !!failure &&
      mode !== undefined &&
      (mode !== previousMode || failure !== previousFailure);
    previousFailure = failure;
    previousMode = mode;
    return emit;
  };
}

/** Preserve the emitted severity: connecting a wallet cannot rewrite a failed run. */
export function isRuntimeError(level: string, _values: readonly unknown[]) {
  return level === "error";
}
