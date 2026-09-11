import { describe, expect, it } from "vitest";
import { RequestorJsonRpc } from "../jsonRpc/requestor.js";
import { JsonRpcTransport } from "../jsonRpc/transports/index.js";
import { ClientPublicTestnet } from "./clientPublicTestnet.js";

describe("Client ownership", () => {
  it("disposes default transports owned by an opened Client", async () => {
    const owner = ClientPublicTestnet.open({
      urls: ["ws://example.com"],
    });
    const client = owner.value;

    await owner.dispose();

    await expect(
      client.requestor.requestPayload(
        client.requestor.buildPayload("test", []),
      ),
    ).rejects.toThrow("Cannot use a disposed JsonRpcTransportWebSocket");
  });

  it("creates a bare Client that borrows an externally provided transport", async () => {
    const transport: JsonRpcTransport = {
      request: async (payload) => ({
        id: payload.id,
        jsonrpc: "2.0",
        result: "ok",
      }),
    };
    const client = ClientPublicTestnet.new({
      transport,
    });

    expect(client.requestor.transport).toBe(transport);

    await expect(
      client.requestor.requestPayload(
        client.requestor.buildPayload("test", []),
      ),
    ).resolves.toBe("ok");
  });

  it("keeps legacy constructor Requestor injection compatible", () => {
    const requestor = RequestorJsonRpc.new({
      transport: {
        request: async (payload) => ({
          id: payload.id,
          jsonrpc: "2.0",
          result: "ok",
        }),
      },
    });

    const client = new ClientPublicTestnet({ requestor });

    expect(client.requestor).toBe(requestor);
  });
});
