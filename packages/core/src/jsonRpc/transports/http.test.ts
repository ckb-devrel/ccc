import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestorJsonRpc } from "../requestor.js";
import { JsonRpcTransportFallback } from "./fallback.js";
import { JsonRpcTransportHttp } from "./http.js";
import type { JsonRpcPayload, JsonRpcResponse } from "./transport.js";
import { JsonRpcError } from "./transport.js";

const payload: JsonRpcPayload = {
  id: 0,
  jsonrpc: "2.0",
  method: "test",
  params: [],
};
const response: JsonRpcResponse = {
  id: 0,
  jsonrpc: "2.0",
  result: "ok",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("JsonRpcTransportHttp", () => {
  it.each([400, 429, 503])(
    "cancels the unread HTTP %i body",
    async (status) => {
      const cancel = vi.fn();
      const body = new ReadableStream({ cancel });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(body, { status })),
      );

      await expect(
        new JsonRpcTransportHttp("https://example.com").request(payload),
      ).rejects.toThrow(`HTTP request failed with status ${status}`);
      expect(cancel).toHaveBeenCalledOnce();
      expect(body.locked).toBe(false);
      await expect(body.getReader().read()).resolves.toEqual({
        done: true,
        value: undefined,
      });
    },
  );

  it("preserves the HTTP error when body cancellation rejects", async () => {
    const body = new ReadableStream({
      cancel: () => Promise.reject(new Error("cleanup failed")),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 503 })),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("HTTP request failed with status 503");
  });

  it("preserves the HTTP error when a wrapped cancel throws synchronously", async () => {
    const httpResponse = new Response("unavailable", { status: 503 });
    const cancel = vi
      .spyOn(httpResponse.body!, "cancel")
      .mockImplementation(() => {
        throw new Error("cleanup threw");
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("HTTP request failed with status 503");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("handles a cancellation rejection after the HTTP request has failed", async () => {
    let rejectCancel: (reason: Error) => void = () => {};
    const cancellation = new Promise<void>((_resolve, reject) => {
      rejectCancel = reject;
    });
    const body = new ReadableStream({ cancel: () => cancellation });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 503 })),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("HTTP request failed with status 503");
    rejectCancel(new Error("late cleanup failure"));
    // Let an unhandled rejection surface to the runner if no handler was attached.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("consumes a successful body without cancelling it", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(response)));
        controller.close();
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).resolves.toEqual(response);
    expect(cancel).not.toHaveBeenCalled();
  });

  it.each([200, 201, 299])(
    "parses successful HTTP %i responses",
    async (status) => {
      const fetch = vi.fn(async () => Response.json(response, { status }));
      vi.stubGlobal("fetch", fetch);

      await expect(
        new JsonRpcTransportHttp("https://example.com").request(payload),
      ).resolves.toEqual(response);
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith("https://example.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal) as AbortSignal,
      });
    },
  );

  it.each([300, 304, 400, 401, 403, 404, 408, 429, 500, 502, 503])(
    "rejects HTTP %i without parsing the body",
    async (status) => {
      const httpResponse = new Response(null, { status });
      const json = vi.spyOn(httpResponse, "json");
      const fetch = vi.fn(async () => httpResponse);
      vi.stubGlobal("fetch", fetch);

      await expect(
        new JsonRpcTransportHttp("https://example.com").request(payload),
      ).rejects.toThrow(`HTTP request failed with status ${status}`);
      expect(json).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("clears its timeout after a successful response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(response)),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).resolves.toEqual(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timeout when fetch rejects", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("unavailable"))),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timeout when response parsing rejects", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => Promise.reject(new Error("invalid JSON")),
      })),
    );

    await expect(
      new JsonRpcTransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("invalid JSON");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a request when its timeout expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );

    const request = new JsonRpcTransportHttp(
      "https://example.com",
      1000,
    ).request(payload);
    const rejection = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("HTTP fallback through RequestorJsonRpc", () => {
  const urls = ["https://a.invalid/", "https://b.invalid/"];
  function requestor() {
    return RequestorJsonRpc.new({
      transport: new JsonRpcTransportFallback(
        urls.map((url) => new JsonRpcTransportHttp(url)),
      ),
    });
  }

  it.each([
    [400, { message: "Bad Request" }],
    [401, response],
    [
      403,
      {
        ...response,
        result: undefined,
        error: { code: -1, message: "denied" },
      },
    ],
    [404, "Not Found"],
    [429, { message: "Too Many Requests" }],
    [500, response],
    [503, "Service Unavailable"],
  ])(
    "falls back after HTTP %i and remembers the healthy endpoint",
    async (status, body) => {
      const fetch = vi.fn(async (url: string) =>
        url === urls[0]
          ? new Response(
              typeof body === "string" ? body : JSON.stringify(body),
              { status },
            )
          : Response.json(response),
      );
      vi.stubGlobal("fetch", fetch);
      const rpc = requestor();

      await expect(rpc.requestPayload(payload)).resolves.toBe("ok");
      await expect(rpc.requestPayload(payload)).resolves.toBe("ok");
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        urls[0],
        urls[1],
        urls[1],
      ]);
    },
  );

  it("tries each endpoint once and reports the last HTTP error when exhausted", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        { message: "unavailable" },
        { status: url === urls[0] ? 429 : 503 },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(requestor().requestPayload(payload)).rejects.toThrow(
      "HTTP request failed with status 503",
    );
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls);
  });

  it.each(["invalid JSON", "network error", "empty 204"])(
    "still falls back on %s",
    async (failure) => {
      const fetch = vi.fn(async (url: string) => {
        if (url === urls[1]) {
          return Response.json(response);
        }
        if (failure === "network error") {
          throw new TypeError("fetch failed");
        }
        return failure === "empty 204"
          ? new Response(null, { status: 204 })
          : new Response("invalid JSON");
      });
      vi.stubGlobal("fetch", fetch);

      await expect(requestor().requestPayload(payload)).resolves.toBe("ok");
      expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls);
    },
  );

  it("preserves JSON-RPC errors under HTTP 200 without fallback", async () => {
    const error = {
      code: -32602,
      message: "Invalid params",
      data: { field: "test" },
    };
    const fetch = vi.fn(async () =>
      Response.json({ id: payload.id, jsonrpc: "2.0", error }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(requestor().requestPayload(payload)).rejects.toEqual(
      new JsonRpcError(error),
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("preserves ID validation under HTTP 200 without fallback", async () => {
    const fetch = vi.fn(async () => Response.json({ ...response, id: 1 }));
    vi.stubGlobal("fetch", fetch);

    await expect(requestor().requestPayload(payload)).rejects.toThrow(
      "Id mismatched, got 1, expected 0",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("forwards cancellation to every attempted endpoint and preserves its reason", async () => {
    const controller = new AbortController();
    const reason = new Error("cancelled");
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      controller.abort(reason);
      init?.signal?.throwIfAborted();
      return Response.json(response);
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      requestor().requestPayload(payload, { signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls);
    for (const [, init] of fetch.mock.calls) {
      expect(init?.signal?.aborted).toBe(true);
    }
  });
});
