import { ccc } from "@ckb-ccc/ccc";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { createCheckpointQueue } from "../src/app/checkpointQueue";
import { ExampleWallet } from "../src/app/exampleWallet";
import { execute } from "../src/app/execute";
import {
  createWalletBindings,
  hasSignerNetworkMismatch,
  MissingWalletError,
} from "../src/app/execute/wallet";
import { captureOutputEntry } from "../src/app/output";
import { createOutputSessionGate } from "../src/app/outputSession";
import { verifyShareAttempt, type ShareAttempt } from "../src/app/shareAttempt";

function compile(code: string, env: Record<string, unknown>) {
  return new Function(
    ...Object.keys(env),
    ts.transpile(code, { target: ts.ScriptTarget.ES2022 }),
  )(...Object.values(env));
}
describe("reviewed lifecycle regressions", () => {
  const client = { addressPrefix: "ckt" } as ccc.Client;
  // Exercise the real provider's queued captures without a browser timer.
  const context = readFileSync(
    new URL("../src/app/context.tsx", import.meta.url),
    "utf8",
  );
  function setupOutput() {
    const gate = createOutputSessionGate();
    const entries: ReturnType<typeof captureOutputEntry>[] = [];
    const callback = (name: string, env: Record<string, unknown>) => {
      const start = context.indexOf(`  const ${name} = useCallback(`);
      const end = context.indexOf("\n\n  useEffect", start);
      return compile(context.slice(start, end) + `; return ${name};`, {
        useCallback: (fn: unknown) => fn,
        ...env,
      });
    };
    const sendMessage = callback("sendMessage", {
      cachedMessagesRef: { current: entries },
      messagesTimeoutRef: { current: 1 },
      messageId: { current: 0 },
      outputClient: client,
      isExampleWallet: false,
      captureOutputEntry,
    });
    const begin = callback("beginOutputRun", {
      outputSessions: { current: gate },
      sendMessage,
    });
    const beginOutputRun = vi.fn(() => begin());
    return { gate, entries, beginOutputRun, sendMessage };
  }
  function setupRun(signer: ccc.Signer | undefined) {
    const page = readFileSync(
      new URL("../src/app/page.tsx", import.meta.url),
      "utf8",
    );
    const start = page.indexOf("  const runCode =");
    const end = page.indexOf("    // Let wallet child views", start);
    const runAndKeyboard =
      page.slice(start, end).replace("  useLayoutEffect(() => {", "") +
      "; return { runCode, onKey };";
    const runScript = vi.fn<typeof execute>(async () => {});
    const clearMessage = vi.fn();
    const { gate, entries, beginOutputRun } = setupOutput();
    const setWalletFailure = vi.fn();
    const setNext = vi.fn<(update?: () => () => void) => void>();
    const setStatus = vi.fn();
    const deferredHistoryRestore = { current: vi.fn() };
    const sourceRef = { current: 'console.log("fixture")' };
    const { runCode, onKey } = compile(runAndKeyboard, {
      client,
      signer,
      hasSignerNetworkMismatch,
      useCallback: (callback: unknown) => callback,
      running: { current: false },
      checkpointQueue: { current: undefined },
      deferredHistoryRestore,
      createCheckpointQueue,
      sourceRef,
      execute: runScript,
      clearMessage,
      beginOutputRun,
      MissingWalletError,
      isLoading: false,
      autoClear: true,
      dialog: undefined,
      isWalletDialogOpen: false,
      next: undefined,
      setWalletFailure,
      setHasRun: vi.fn(),
      setIsRunning: vi.fn(),
      setMobilePane: vi.fn(),
      setStatus,
      setHighlight: vi.fn(),
      setNext,
    });
    return {
      runCode,
      onKey,
      execute: runScript,
      clearMessage,
      beginOutputRun,
      gate,
      entries,
      setWalletFailure,
      setNext,
      setStatus,
      deferredHistoryRestore,
      sourceRef,
    };
  }
  it("blocks Run, Step and the keyboard shortcut while a connected signer is on the previous network", async () => {
    const oldSigner = { client: { addressPrefix: "ckb" } } as ccc.Signer;
    const currentSigner = { client } as ccc.Signer;
    const blocked = setupRun(oldSigner);
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
      const ready = setupRun(signer);
      await ready.runCode(false);
      expect(ready.execute).toHaveBeenCalledOnce();
      expect(ready.execute.mock.calls[0]?.[2]).toBe(signer);
    }
    const ready = setupRun(currentSigner);
    ready.onKey(shortcut);
    expect(ready.execute).toHaveBeenCalledOnce();
  });

  it("keeps the second awaited Step checkpoint after a signer change invalidates output", async () => {
    const f = setupRun({ client } as ccc.Signer);
    f.execute.mockImplementation(execute);
    f.sourceRef.current = [
      'import {render} from "@ckb-ccc/playground";',
      'await render("first");',
      'await render("second");',
    ].join("\n");
    const completion = f.runCode(false);
    const first = f.setNext.mock.lastCall![0]!();
    f.gate.invalidate();
    first();
    // Let the script reach its next awaited render, without advancing it.
    await new Promise<void>((done) => setTimeout(done, 0));
    expect(f.setStatus.mock.lastCall?.[0]).toMatch(/^Paused at /);
    expect(f.deferredHistoryRestore.current).not.toHaveBeenCalled();
    const second = f.setNext.mock.lastCall![0]!();
    expect(second).not.toBe(first);
    second();
    await completion;
    expect(f.setStatus.mock.lastCall?.[0]).toBe("Run complete");
    expect(f.deferredHistoryRestore.current).toHaveBeenCalledOnce();
    expect(f.execute).toHaveBeenCalledOnce();
  });

  it.each([
    "await render(signer)",
    "console.log(signer)",
    "console.log({ signer })",
    "console.error({ signer })",
    "console.log({ get address() { return signer.client; } })",
  ])(
    "stops with wallet recovery when script output inspects %s",
    async (statement) => {
      const f = setupRun(undefined);
      f.execute.mockImplementation(execute);
      f.sourceRef.current = `import { render, signer } from "@ckb-ccc/playground";
      console.log("before"); ${statement}; console.log("after");`;
      await f.runCode(true);
      const failure = f.setWalletFailure.mock.lastCall?.[0];
      expect(failure).toBeInstanceOf(MissingWalletError);
      expect(f.setStatus.mock.lastCall?.[0]).toBe("Run failed");
      expect(f.entries.map(([level, , values]) => [level, values])).toEqual([
        ["info", ["before"]],
        ["error", [failure]],
      ]);
      expect(f.entries[1][2][0]).toBe(failure); // Recovery matches by identity.
    },
  );

  it("preserves a structured terminal failure even when it contains the missing signer", async () => {
    const f = setupRun(undefined);
    f.execute.mockImplementation(execute);
    f.sourceRef.current = `import { signer } from "@ckb-ccc/playground";
      throw { reason: "Invalid input", signer };`;
    await f.runCode(true);
    expect(f.setStatus.mock.lastCall?.[0]).toBe("Run failed");
    expect(f.setWalletFailure).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(f.entries).toHaveLength(1);
    expect(f.entries[0].slice(0, 3)).toEqual([
      "error",
      "Execution failed",
      [{ reason: "Invalid input", signer: expect.any(Error) }],
    ]);
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
    const remember = (value: ShareAttempt | undefined) => {
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
    expect(attempt).toBeUndefined();

    // On reopening Share the same editor text can be published again, even
    // if the relays have stopped serving the previously verified event ID.
    publish.mockResolvedValueOnce("new-id");
    read.mockImplementation(async (id) =>
      id === "new-id" ? "old source" : undefined,
    );
    await expect(
      verifyShareAttempt("old source", attempt, publish, read, remember),
    ).resolves.toBe("new-id");
    expect(publish).toHaveBeenCalledTimes(2);
    expect(attempt).toBeUndefined();
  });
  it("offers read-only retry on failure and can explicitly publish the same source as a new event", async () => {
    const source = "same source";
    const publish = vi
      .fn()
      .mockResolvedValueOnce("old-id")
      .mockResolvedValueOnce("new-id");
    const read = vi.fn(async (id: string) =>
      id === "new-id" ? source : undefined,
    );
    let pending: ShareAttempt | undefined;
    const remember = (attempt: ShareAttempt | undefined) => {
      pending = attempt;
    };
    await expect(
      verifyShareAttempt(source, pending, publish, read, remember),
    ).rejects.toThrow("could not be verified");
    await expect(
      verifyShareAttempt(source, pending, publish, read, remember),
    ).rejects.toThrow("could not be verified");
    expect(read.mock.calls).toEqual([["old-id"], ["old-id"]]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(pending).toEqual({ id: "old-id", source });

    // New publication is a distinct user action, never a read-back fallback.
    await expect(
      verifyShareAttempt(source, undefined, publish, read, remember),
    ).resolves.toBe("new-id");
    expect(publish).toHaveBeenCalledTimes(2);
    expect(pending).toBeUndefined();
  });
  it("abandons the old retry before a fresh publication receives an ID", async () => {
    let pending: ShareAttempt | undefined = { id: "id-A", source: "old code" };
    const remember = (attempt: ShareAttempt | undefined) => {
      pending = attempt;
    };
    const publish = vi.fn(async () => {
      throw Error("no acknowledgement");
    });
    const read = vi.fn();

    const fresh = verifyShareAttempt(
      "new code",
      undefined,
      publish,
      read,
      remember,
    );
    expect(pending).toBeUndefined();
    await expect(fresh).rejects.toThrow("no acknowledgement");
    expect(pending).toBeUndefined();

    // The next primary action must try B again, never read back A's link.
    await expect(
      verifyShareAttempt("new code", pending, publish, read, remember),
    ).rejects.toThrow("no acknowledgement");
    expect(publish.mock.calls).toEqual([["new code"], ["new code"]]);
    expect(read).not.toHaveBeenCalled();
  });
  it("invalidated run drops late logs but reports its terminal error once using captured sender", () => {
    const { gate, beginOutputRun, entries } = setupOutput();
    const run = beginOutputRun();
    gate.invalidate();
    run.log("info", "late", ["wrong"]);
    const error = Error("original failure");
    run.terminalError(error);
    run.terminalError(error);
    expect(entries).toHaveLength(1);
    expect(entries[0].slice(0, 3)).toEqual([
      "error",
      "Execution failed after wallet/network changed",
      [error],
    ]);
  });
  it("preserves structured global rejection reasons and existing Error identities", () => {
    const start = context.indexOf(
      "    const handler = (event: PromiseRejectionEvent)",
    );
    const end = context.indexOf(
      '\n\n    window.addEventListener("unhandledrejection"',
      start,
    );
    const { sendMessage, entries } = setupOutput();
    const handler = compile(context.slice(start, end) + ";return handler;", {
      sendMessage,
      formatTimestamp: () => "now",
    });
    const { signer } = createWalletBindings(client, undefined);
    const reason = {
      code: "RPC_FAILED",
      detail: "upstream unavailable",
      signer,
    };
    handler({ reason });
    expect(entries[0][2][1]).toEqual({
      code: "RPC_FAILED",
      detail: "upstream unavailable",
      signer: expect.any(Error),
    });
    const error = Error("known");
    handler({ reason: error });
    expect(entries[1][2][0]).toBe(error);
  });
});
