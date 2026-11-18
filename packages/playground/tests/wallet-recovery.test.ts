import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it } from "vitest";
import { MissingWalletError } from "../src/app/execute/wallet";
import { captureOutputEntry } from "../src/app/output";
import {
  createWalletRecoveryTracker,
  isRuntimeError,
  WalletReadyMessage,
} from "../src/app/walletRecovery";

describe("wallet recovery timeline", () => {
  it("waits for success, emits once, and ignores rerenders/network changes", () => {
    const next = createWalletRecoveryTracker();
    const failure = new MissingWalletError();
    expect(next(failure, false)).toBe(false);
    expect(next(failure, false)).toBe(false); // canceled or failed connection
    expect(next(failure, true)).toBe(true);
    expect(next(failure, true)).toBe(false); // new signer object/network, still connected
    expect(next(failure, false)).toBe(false);
    expect(next(failure, true)).toBe(true); // explicit reconnection
  });
  it("does not revive cleared or previous-run recovery", () => {
    const next = createWalletRecoveryTracker();
    expect(next(new MissingWalletError(), false)).toBe(false);
    expect(next(undefined, false)).toBe(false); // Clear or next Run
    expect(next(undefined, true)).toBe(false);
    expect(next(new MissingWalletError(), false)).toBe(false);
    expect(next(new MissingWalletError(), true)).toBe(true);
  });
  it("keeps readiness marker and its original wallet mode and failure identity", () => {
    const failure = new MissingWalletError();
    const ready = new WalletReadyMessage(failure, true);
    const entry = captureOutputEntry(
      "info",
      "Ready to run",
      [ready],
      1,
      new ccc.ClientPublicTestnet(),
      true,
    );
    expect(entry[2][0]).toBe(ready);
    expect(ready.failure).toBe(failure);
    expect(ready.example).toBe(true);
  });
  it("keeps the original failure in the error filter after readiness is appended", () => {
    const failure = new MissingWalletError();
    const client = new ccc.ClientPublicTestnet();
    const error = captureOutputEntry(
      "error",
      "Execution failed",
      [failure],
      1,
      client,
      false,
    );
    const ready = captureOutputEntry(
      "info",
      "Ready to run",
      [new WalletReadyMessage(failure, true)],
      2,
      client,
      true,
    );
    const errors = [error, ready].filter(([level, , values]) =>
      isRuntimeError(level, values),
    );
    expect(errors).toEqual([error]);
    expect(error[2][0]).toBe(failure);
  });
  it("preserves failed-run errors while readiness is informational", () => {
    expect(isRuntimeError("info", [new MissingWalletError()])).toBe(false);
    expect(isRuntimeError("error", [new MissingWalletError()])).toBe(true);
    expect(
      isRuntimeError("info", [
        new WalletReadyMessage(new MissingWalletError(), true),
      ]),
    ).toBe(false);
    expect(isRuntimeError("error", [new Error("bad script")])).toBe(true);
    expect(isRuntimeError("error", ["bad script"])).toBe(true);
  });
});
