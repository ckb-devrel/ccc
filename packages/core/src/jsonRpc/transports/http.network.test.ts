import {
  createServer,
  type RequestListener,
  type ServerResponse,
} from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonRpcTransportFallback } from "./fallback.js";
import { JsonRpcTransportHttp } from "./http.js";

const payload = { id: 0, jsonrpc: "2.0" as const, method: "test", params: [] };

describe("HTTP response body lifecycle with native fetch", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.closeAllConnections();
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  it("falls back while a logging clone is still reading the error body", async () => {
    let errorResponse: ServerResponse | undefined;
    let healthyCalls = 0;
    const url = await serve((request, response) => {
      request.resume();
      if (request.url === "/failed") {
        errorResponse = response;
        response.writeHead(503);
        response.write("unfinished error body");
      } else {
        healthyCalls += 1;
        response.end(JSON.stringify({ ...payload, result: "ok" }));
      }
    });
    const nativeFetch = globalThis.fetch;
    let logging: Promise<string> | undefined;
    let loggingFinished = false;
    vi.stubGlobal("fetch", async (...args: Parameters<typeof fetch>) => {
      const response = await nativeFetch(...args);
      if (!response.ok) {
        logging = response
          .clone()
          .text()
          .then((text) => {
            loggingFinished = true;
            return text;
          });
      }
      return response;
    });
    const transport = new JsonRpcTransportFallback([
      new JsonRpcTransportHttp(`${url}/failed`, 5000),
      new JsonRpcTransportHttp(`${url}/healthy`, 5000),
    ]);
    const pending = transport.request(payload);
    try {
      await expect.poll(() => healthyCalls, { timeout: 1000 }).toBe(1);
      await expect(pending).resolves.toMatchObject({ result: "ok" });
      expect(loggingFinished).toBe(false);
    } finally {
      errorResponse?.end();
      await logging;
      await pending;
    }
    expect(loggingFinished).toBe(true);
  });

  async function serve(handler: RequestListener) {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address");
    }
    return `http://127.0.0.1:${address.port}`;
  }

  it("closes an unfinished error body while fallback succeeds", async () => {
    let closed = false;
    const url = await serve((request, response) => {
      request.resume();
      if (request.url === "/failed") {
        response.on("close", () => {
          closed = true;
        });
        response.writeHead(429, { "content-type": "application/json" });
        response.write('{"message":"still streaming');
        // Deliberately never finish the error response.
      } else {
        response.end(JSON.stringify({ ...payload, result: "ok" }));
      }
    });
    const transport = new JsonRpcTransportFallback([
      new JsonRpcTransportHttp(`${url}/failed`, 30000),
      new JsonRpcTransportHttp(`${url}/healthy`, 30000),
    ]);

    await expect(transport.request(payload)).resolves.toMatchObject({
      result: "ok",
    });
    await expect.poll(() => closed, { timeout: 1000 }).toBe(true);
  });

  it("releases a successful response being read when the caller cancels", async () => {
    let closed = false;
    let started: () => void = () => {};
    const bodyStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const url = await serve((request, response) => {
      request.resume();
      response.on("close", () => {
        closed = true;
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"result":"still streaming');
      started();
    });
    const controller = new AbortController();
    const pending = new JsonRpcTransportHttp(url).request(payload, {
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await bodyStarted;
    controller.abort();
    await rejected;
    await expect.poll(() => closed, { timeout: 1000 }).toBe(true);
  });
});
