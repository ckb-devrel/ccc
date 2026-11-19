import { ccc } from "@ckb-ccc/ccc";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { createCheckpointQueue } from "../src/app/checkpointQueue";
import { ExampleWallet } from "../src/app/exampleWallet";
import { execute } from "../src/app/execute";
import {
  hasSignerNetworkMismatch,
  MissingWalletError,
} from "../src/app/execute/wallet";
import { createOutputSessionGate } from "../src/app/outputSession";
import { verifyShareAttempt, type ShareAttempt } from "../src/app/shareAttempt";

function compile(code: string, env: Record<string, unknown>) {
  return new Function(
    ...Object.keys(env),
    ts.transpile(code, { target: ts.ScriptTarget.ES2022 }),
  )(...Object.values(env));
}
describe("reviewed lifecycle regressions", () => {
  it("blocks Run, Step and the keyboard shortcut while a connected signer is on the previous network", async () => {
    const page = readFileSync(
      new URL("../src/app/page.tsx", import.meta.url),
      "utf8",
    );
    const start = page.indexOf("  const runCode =");
    const end = page.indexOf("    // Let wallet child views", start);
    const runAndKeyboard =
      page.slice(start, end).replace("  useLayoutEffect(() => {", "") +
      "; return { runCode, onKey };";
    const client = { addressPrefix: "ckt" } as ccc.Client;
    const oldSigner = { client: { addressPrefix: "ckb" } } as ccc.Signer;
    const currentSigner = { client } as ccc.Signer;
    function setup(signer: ccc.Signer | undefined) {
      const execute = vi.fn<typeof import("../src/app/execute").execute>(
        async () => {},
      );
      const clearMessage = vi.fn();
      const beginOutputRun = vi.fn(() => ({}));
      const { runCode, onKey } = compile(runAndKeyboard, {
        client,
        signer,
        hasSignerNetworkMismatch,
        useCallback: (callback: unknown) => callback,
        running: { current: false },
        checkpointQueue: { current: undefined },
        deferredHistoryRestore: { current: undefined },
        createCheckpointQueue,
        sourceRef: { current: 'console.log("fixture")' },
        execute,
        clearMessage,
        beginOutputRun,
        MissingWalletError,
        isLoading: false,
        autoClear: true,
        dialog: undefined,
        isWalletDialogOpen: false,
        next: undefined,
        setWalletFailure: vi.fn(),
        setHasRun: vi.fn(),
        setIsRunning: vi.fn(),
        setMobilePane: vi.fn(),
        setStatus: vi.fn(),
        setHighlight: vi.fn(),
        setNext: vi.fn(),
      });
      return { runCode, onKey, execute, clearMessage, beginOutputRun };
    }
    const blocked = setup(oldSigner);
    const shortcut = {
      key: "Enter",
      ctrlKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    await blocked.runCode(true);
    await blocked.runCode(false);
    blocked.onKey(shortcut);
    expect(shortcut.preventDefault).toHaveBeenCalledOnce();
    expect(blocked.execute).not.toHaveBeenCalled();
    expect(blocked.beginOutputRun).not.toHaveBeenCalled();
    expect(blocked.clearMessage).not.toHaveBeenCalled();

    const exampleSigner = new ExampleWallet(client);
    for (const signer of [currentSigner, undefined, exampleSigner]) {
      const ready = setup(signer);
      await ready.runCode(false);
      expect(ready.execute).toHaveBeenCalledOnce();
      expect(ready.execute.mock.calls[0]?.[2]).toBe(signer);
    }
    const ready = setup(currentSigner);
    ready.onKey(shortcut);
    expect(ready.execute).toHaveBeenCalledOnce();
  });

  it("unsupported stack still creates an awaited checkpoint without a fabricated highlight", async () => {
    const original = Error.prepareStackTrace;
    Error.prepareStackTrace = () => "unsupported stack format";
    let release!: () => void;
    const log = vi.fn();
    try {
      const execution = execute(
        'import {render} from "@ckb-ccc/playground"; await render("before"); console.log("after")',
        async (position, checkpoint) => {
          if (checkpoint) {
            expect(position).toBeUndefined();
            await new Promise<void>((r) => (release = r));
          }
        },
        undefined,
        log,
        {} as ccc.Client,
      );
      await Promise.resolve();
      expect(log.mock.calls.flat(2)).not.toContain("after");
      release();
      await execution;
      expect(log.mock.calls.flat(2)).toContain("after");
    } finally {
      Error.prepareStackTrace = original;
    }
  });
  it("retries acknowledged share read-back without republishing or changing its snapshot", async () => {
    let attempt: ShareAttempt | undefined;
    const publish = vi.fn(async () => "nevent-id");
    const read = vi
      .fn()
      .mockRejectedValueOnce(Error("timeout"))
      .mockResolvedValue("old source");
    const remember = (value: ShareAttempt) => {
      attempt = value;
    };
    await expect(
      verifyShareAttempt("old source", attempt, publish, read, remember),
    ).rejects.toThrow("timeout");
    expect(
      await verifyShareAttempt(
        "edited source",
        attempt,
        publish,
        read,
        remember,
      ),
    ).toBe("nevent-id");
    expect(publish).toHaveBeenCalledExactlyOnceWith("old source");
    expect(read).toHaveBeenNthCalledWith(2, "nevent-id");
  });
  it("invalidated run drops late logs but reports its terminal error once using captured sender", () => {
    const context = readFileSync(
      new URL("../src/app/context.tsx", import.meta.url),
      "utf8",
    );
    const start = context.indexOf("  const beginOutputRun =");
    const end = context.indexOf("\n\n  useEffect", start);
    const sendMessage = vi.fn();
    const gate = createOutputSessionGate();
    const begin = compile(
      context.slice(start, end) + "; return beginOutputRun;",
      {
        useCallback: (fn: unknown) => fn,
        outputSessions: { current: gate },
        sendMessage,
      },
    );
    const run = begin();
    gate.invalidate();
    run.log("info", "late", ["wrong"]);
    const error = Error("original failure");
    run.terminalError(error);
    run.terminalError(error);
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith(
      "error",
      "Execution failed after wallet/network changed",
      [error],
    );
  });
  it("preserves structured global rejection reasons and existing Error identities", () => {
    const context = readFileSync(
      new URL("../src/app/context.tsx", import.meta.url),
      "utf8",
    );
    const start = context.indexOf(
      "    const handler = (event: PromiseRejectionEvent)",
    );
    const end = context.indexOf(
      '\n\n    window.addEventListener("unhandledrejection"',
      start,
    );
    const sendMessage = vi.fn();
    const handler = compile(context.slice(start, end) + ";return handler;", {
      sendMessage,
      formatTimestamp: () => "now",
    });
    const reason = { code: "RPC_FAILED", detail: "upstream unavailable" };
    handler({ reason });
    expect(sendMessage.mock.calls[0][2][1]).toBe(reason);
    const error = Error("known");
    handler({ reason: error });
    expect(sendMessage.mock.calls[1][2]).toEqual([error]);
  });
});
