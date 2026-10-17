import { ccc } from "@ckb-ccc/core";
import { describe, expect, it, vi } from "vitest";
import {
  ExecutorErrorDecode,
  ExecutorErrorExecutionFailed,
  ExecutorErrorUnknown,
  ExecutorJsonRpc,
  ExecutorResponse,
} from "./executor.js";

const codeOutPoint = { txHash: `0x${"00".repeat(32)}`, index: 0 };

describe("SSRI error details", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const unprintable = new Proxy(
    {},
    {
      get() {
        throw new Error("cannot read property");
      },
      has() {
        throw new Error("cannot inspect property");
      },
    },
  );
  const cases: { label: string; cause: unknown; message: string }[] = [
    {
      label: "Error",
      cause: new TypeError("network failed"),
      message: "network failed",
    },
    { label: "empty Error", cause: new Error(""), message: "" },
    {
      label: "error-like object",
      cause: { message: "request failed", detail: 1 },
      message: "request failed",
    },
    {
      label: "string",
      cause: "plain failure\nwith details",
      message: "plain failure\nwith details",
    },
    { label: "number", cause: 42, message: "42" },
    { label: "boolean", cause: false, message: "false" },
    { label: "null", cause: null, message: "null" },
    { label: "undefined", cause: undefined, message: "undefined" },
    { label: "bigint", cause: 123n, message: "123" },
    { label: "symbol", cause: Symbol("failure"), message: "Symbol(failure)" },
    {
      label: "plain object",
      cause: { details: "failure" },
      message: '{"details":"failure"}',
    },
    {
      label: "non-string message",
      cause: { message: 42 },
      message: '{"message":42}',
    },
    { label: "circular object", cause: circular, message: "[object Object]" },
    {
      label: "throwing toJSON",
      cause: {
        toJSON() {
          throw new Error("cannot serialize");
        },
      },
      message: "[object Object]",
    },
    {
      label: "throwing message getter",
      cause: {
        get message() {
          throw new Error("cannot read message");
        },
      },
      message: "[object Object]",
    },
    {
      label: "unprintable value",
      cause: unprintable,
      message: "Unknown error",
    },
  ];

  it.each(cases)(
    "preserves $label thrown by a Transport",
    async ({ cause, message }) => {
      const executor = ExecutorJsonRpc.new({
        transport: {
          request: async () => {
            throw cause;
          },
        },
      });
      const wrapped: unknown = await executor
        .runScript(codeOutPoint, "UDT.name", [])
        .catch((err: unknown) => err);

      expect(wrapped).toBeInstanceOf(ExecutorErrorUnknown);
      expect((wrapped as Error).message).toBe(message);
      expect((wrapped as Error).cause).toBe(cause);
      expect(Object.keys(wrapped as Error)).not.toContain("cause");
    },
  );

  it.each(cases)(
    "preserves $label thrown by a decoder",
    ({ cause, message }) => {
      let wrapped: unknown;
      try {
        ExecutorResponse.new("0x").map(() => {
          throw cause;
        });
      } catch (err) {
        wrapped = err;
      }

      expect(wrapped).toBeInstanceOf(ExecutorErrorDecode);
      expect((wrapped as Error).message).toBe(message);
      expect((wrapped as Error).cause).toBe(cause);
      expect(Object.keys(wrapped as Error)).not.toContain("cause");
    },
  );

  it("preserves transport Error messages and causes", async () => {
    const cause = new Error("connection refused");
    const executor = ExecutorJsonRpc.new({
      transport: {
        request: async () => {
          throw cause;
        },
      },
    });

    await expect(
      executor.runScript(codeOutPoint, "UDT.name", []),
    ).rejects.toThrow(
      expect.objectContaining({
        constructor: ExecutorErrorUnknown,
        message: cause.message,
        cause,
      }),
    );
  });

  it("preserves malformed transaction decoding details", () => {
    let wrapped: unknown;
    try {
      ExecutorResponse.new("0x00").map((res) => ccc.Transaction.fromBytes(res));
    } catch (err) {
      wrapped = err;
    }

    expect(wrapped).toBeInstanceOf(ExecutorErrorDecode);
    const cause = (wrapped as Error).cause;
    expect(cause).toBeInstanceOf(Error);
    expect((wrapped as Error).message).toContain("too short buffer");
    expect((wrapped as Error).message).toBe((cause as Error).message);
  });

  it("preserves real HTTP connection failure details", async () => {
    const owner = ExecutorJsonRpc.open({ urls: ["http://127.0.0.1:1"] });
    try {
      const wrapped: unknown = await owner.value
        .runScript(codeOutPoint, "UDT.name", [])
        .catch((err: unknown) => err);

      expect(wrapped).toBeInstanceOf(ExecutorErrorUnknown);
      const cause = (wrapped as Error).cause;
      expect(cause).toBeInstanceOf(Error);
      expect((wrapped as Error).message).toBe((cause as Error).message);
      expect((wrapped as Error).message).not.toBe("");
      expect((wrapped as Error).message).not.toBe("{}");
    } finally {
      await owner.dispose();
    }
  });

  it.each([1003, 1004, -32603, 1002])(
    "keeps JSON-RPC code %s classification and metadata",
    async (code) => {
      const data = { reason: "VM failure" };
      const executor = ExecutorJsonRpc.new({
        transport: {
          request: async (payload) => ({
            id: payload.id,
            jsonrpc: "2.0",
            error: { code, message: "execution failed", data },
          }),
        },
      });
      const wrapped: unknown = await executor
        .runScript(codeOutPoint, "UDT.name", [])
        .catch((err: unknown) => err);

      expect(wrapped).toBeInstanceOf(
        code === 1003 || code === 1004
          ? ExecutorErrorExecutionFailed
          : ExecutorErrorUnknown,
      );
      expect((wrapped as Error).message).toBe("execution failed");
      expect((wrapped as Error).cause).toBeInstanceOf(ccc.JsonRpcError);
      expect((wrapped as Error).cause).toMatchObject({
        code,
        message: "execution failed",
        data,
      });
      if (code === 1003 || code === 1004) {
        await expect(
          executor.runScriptTry(codeOutPoint, "UDT.name", []),
        ).resolves.toBeUndefined();
      } else {
        await expect(
          executor.runScriptTry(codeOutPoint, "UDT.name", []),
        ).rejects.toBeInstanceOf(ExecutorErrorUnknown);
      }
    },
  );

  it.each([
    { code: 1003, type: ExecutorErrorExecutionFailed },
    { code: 1004, type: ExecutorErrorExecutionFailed },
    { code: 1002, type: ExecutorErrorUnknown },
    { code: "1003", type: ExecutorErrorUnknown },
  ])(
    "retains code $code when no message is supplied",
    async ({ code, type }) => {
      const cause: unknown = { code };
      const executor = ExecutorJsonRpc.new({
        transport: {
          request: async () => {
            throw cause;
          },
        },
      });
      const wrapped: unknown = await executor
        .runScript(codeOutPoint, "UDT.name", [])
        .catch((err: unknown) => err);

      expect(wrapped).toBeInstanceOf(type);
      expect((wrapped as Error).message).toBe(JSON.stringify(cause));
      expect((wrapped as Error).cause).toBe(cause);
    },
  );

  it.each([
    ExecutorErrorUnknown,
    ExecutorErrorExecutionFailed,
    ExecutorErrorDecode,
  ])("keeps %s constructor compatibility", (ErrorType) => {
    expect(new ErrorType()).toBeInstanceOf(Error);
    expect(new ErrorType().message).toBe("");
    expect(new ErrorType("existing message").message).toBe("existing message");
    const cause = new Error("original failure");
    expect(new ErrorType("wrapped", { cause }).cause).toBe(cause);
  });

  it("keeps successful mappings and cell dependencies", () => {
    const response = ExecutorResponse.new(2, [codeOutPoint]);
    const mapped = response.map((value) => value + 1);

    expect(mapped.res).toBe(3);
    expect(mapped.cellDeps).toBe(response.cellDeps);
  });
});

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
