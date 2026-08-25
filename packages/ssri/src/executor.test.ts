import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import { ExecutorErrorExecutionFailed, ExecutorJsonRpc } from "./executor.js";

describe("ExecutorJsonRpc ownership", () => {
  it("creates an Executor that borrows an externally provided Transport", async () => {
    const request = vi.fn<ccc.JsonRpcTransport["request"]>(async (payload) => ({
      id: payload.id,
      jsonrpc: "2.0",
      result: { content: "0x", cell_deps: [] },
    }));
    const executor = ExecutorJsonRpc.new({ transport: { request } });

    await expect(
      executor.runScript(
        { txHash: `0x${"00".repeat(32)}`, index: 0 },
        "SSRI.version",
        [],
      ),
    ).resolves.toMatchObject({ res: "0x", cellDeps: [] });
    expect(request).toHaveBeenCalledOnce();
  });

  it("maps SSRI execution errors for borrowed Transports", async () => {
    const executor = ExecutorJsonRpc.new({
      transport: {
        request: async (payload) => ({
          id: payload.id,
          jsonrpc: "2.0",
          error: { code: 1003, message: "execution failed" },
        }),
      },
    });

    await expect(
      executor.runScript(
        { txHash: `0x${"00".repeat(32)}`, index: 0 },
        "SSRI.version",
        [],
      ),
    ).rejects.toThrow(ExecutorErrorExecutionFailed);
  });

  it("keeps legacy constructor Requestor injection compatible", () => {
    const requestor = ccc.RequestorJsonRpc.new({
      transport: {
        request: async (payload) => ({
          id: payload.id,
          jsonrpc: "2.0",
          result: "ok",
        }),
      },
    });

    const executor = new ExecutorJsonRpc("https://example.com", { requestor });

    expect(executor.requestor).toBe(requestor);
    expect(executor.url).toBe("https://example.com");
  });

  it("opens an owned Executor", async () => {
    const owner = ExecutorJsonRpc.open({ urls: ["ws://example.com"] });
    const executor = owner.value;

    expect(executor).toBeInstanceOf(ExecutorJsonRpc);

    await owner.dispose();
    expect(() => owner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
    await expect(
      executor.requestor.requestPayload(
        executor.requestor.buildPayload("test", []),
      ),
    ).rejects.toThrow("Cannot use a disposed JsonRpcTransportWebSocket");
  });
});
