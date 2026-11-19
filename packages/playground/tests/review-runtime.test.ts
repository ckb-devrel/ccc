import { ccc } from "@ckb-ccc/ccc";
import { describe, expect, it, vi } from "vitest";
import { ExampleWallet } from "../src/app/exampleWallet";
import { execute } from "../src/app/execute";
import {
  createWalletBindings,
  MissingWalletError,
} from "../src/app/execute/wallet";
import { captureOutputEntry, type OutputOrigin } from "../src/app/output";
import {
  createOutputRun,
  reportUnhandledRejection,
} from "../src/app/outputRun";
import { createOutputSessionGate } from "../src/app/outputSession";
import { verifyShareAttempt, type ShareAttempt } from "../src/app/shareAttempt";
import { createSourceDocument } from "../src/app/sourceDocument";
import {
  createWorkbenchExecution,
  handleExecutionShortcut,
  type ExecutionView,
} from "../src/app/workbenchExecution";

describe("reviewed lifecycle regressions", () => {
  const client = { addressPrefix: "ckt" } as ccc.Client;
  function setupOutput() {
    const gate = createOutputSessionGate();
    const entries: ReturnType<typeof captureOutputEntry>[] = [];
    const sendMessage = (
      level: "error" | "info",
      title: string,
      msgs: unknown[],
      origin: OutputOrigin = "diagnostic",
    ) => {
      entries.push(
        captureOutputEntry(
          level,
          title,
          msgs,
          entries.length,
          client,
          false,
          origin,
        ),
      );
    };
    const beginOutputRun = vi.fn(() => createOutputRun(gate, sendMessage));
    return { gate, entries, beginOutputRun, sendMessage };
  }

  function setupRun(signer: ccc.Signer | undefined) {
    const runScript = vi.fn<typeof execute>(async () => {});
    const clearMessage = vi.fn();
    const { gate, entries, beginOutputRun } = setupOutput();
    const publish = vi.fn<(view: ExecutionView) => void>();
    const execution = createWorkbenchExecution(publish, runScript);
    const onSettled = vi.fn();
    const sourceRef = { current: 'console.log("fixture")' };
    const runCode = (autoPlay: boolean) =>
      execution.run({
        source: sourceRef.current,
        isLoading: false,
        autoPlay,
        client,
        signer,
        beginOutputRun,
        clearOutput: clearMessage,
        onStart: () => {},
        onSettled,
      });
    const onKey = (event: KeyboardEvent) =>
      handleExecutionShortcut(event, false, () => void runCode(true));
    const view = () => publish.mock.lastCall![0];
    return {
      execution,
      runCode,
      onKey,
      execute: runScript,
      clearMessage,
      beginOutputRun,
      gate,
      entries,
      publish,
      view,
      onSettled,
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
    } as unknown as KeyboardEvent;
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

  it("retains both Step checkpoints and defers Back until execution settles after output invalidation", async () => {
    const f = setupRun({ client } as ccc.Signer);
    f.execute.mockImplementation(execute);
    f.sourceRef.current = [
      'import {render} from "@ckb-ccc/playground";',
      'await render("first");',
      'await render("second");',
    ].join("\n");
    let location = new URL(
      "https://playground.test/?src=https://example.test/code",
    );
    const sourceDocument = createSourceDocument(
      {
        storage: () => ({ getItem: () => "saved draft", setItem: vi.fn() }),
        location: () => new URL(location),
        pushHistory: vi.fn(),
        confirm: () => true,
        readRemote: async () => f.sourceRef.current,
        isExecuting: f.execution.isActive,
        onOpened: vi.fn(),
      },
      vi.fn(),
    );
    await sourceDocument.restoreHistory();
    f.onSettled.mockImplementation(() => void sourceDocument.flushHistory());
    const completion = f.runCode(false);
    const first = f.view().next!;
    await f.runCode(true); // A paused execution cannot be replaced by another Run.
    f.gate.invalidate();
    location = new URL("https://playground.test/");
    sourceDocument.restoreHistory();
    expect(sourceDocument.getDocument().text).toBe(f.sourceRef.current);
    first();
    // Let the script reach its next awaited render, without advancing it.
    await new Promise<void>((done) => setTimeout(done, 0));
    expect(f.view().status).toMatch(/^Paused at /);
    expect(f.onSettled).not.toHaveBeenCalled();
    const second = f.view().next!;
    expect(second).not.toBe(first);
    second();
    await completion;
    expect(f.view()).toMatchObject({
      status: "Run complete",
      isRunning: false,
    });
    expect(f.view().next).toBeUndefined();
    expect(f.view().highlight).toBeUndefined();
    expect(f.onSettled).toHaveBeenCalledOnce();
    expect(sourceDocument.getDocument().text).toBe("saved draft");
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
      const failure = f.view().walletFailure;
      expect(failure).toBeInstanceOf(MissingWalletError);
      expect(f.view().status).toBe("Run failed");
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
    expect(f.view().status).toBe("Run failed");
    expect(
      f.publish.mock.calls.every(([view]) => view.walletFailure === undefined),
    ).toBe(true);
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
    const { sendMessage, entries } = setupOutput();
    const { signer } = createWalletBindings(client, undefined);
    const reason = {
      code: "RPC_FAILED",
      detail: "upstream unavailable",
      signer,
    };
    reportUnhandledRejection(reason, "now", sendMessage);
    expect(entries[0][2][1]).toEqual({
      code: "RPC_FAILED",
      detail: "upstream unavailable",
      signer: expect.any(Error),
    });
    const error = Error("known");
    reportUnhandledRejection(error, "now", sendMessage);
    expect(entries[1][2][0]).toBe(error);
  });
});
