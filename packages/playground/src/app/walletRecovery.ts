import { MissingWalletError } from "./execute/wallet";

/** A historical connection event, not a successful execution result. */
export class WalletReadyMessage {
  constructor(
    readonly failure: MissingWalletError,
    readonly example: boolean,
  ) {}
}

/** Emit once per disconnected → connected transition, not on client changes. */
export function createWalletRecoveryTracker() {
  let previousFailure: MissingWalletError | undefined;
  let connected = false;
  return (failure: MissingWalletError | undefined, available: boolean) => {
    const emit =
      !!failure && available && (!connected || failure !== previousFailure);
    previousFailure = failure;
    connected = available;
    return emit;
  };
}

/** Preserve the emitted severity: connecting a wallet cannot rewrite a failed run. */
export function isRuntimeError(level: string, _values: readonly unknown[]) {
  return level === "error";
}
