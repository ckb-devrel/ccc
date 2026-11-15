import { createServer, type RequestListener } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { JsonRpcTransportFallback } from "./fallback.js";
import { JsonRpcTransportHttp } from "./http.js";

const payload = { id: 0, jsonrpc: "2.0" as const, method: "test", params: [] };

describe("HTTP response body lifecycle with native fetch", () => {
  const servers: ReturnType<typeof createServer>[] = [];
  afterEach(async () => {
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
