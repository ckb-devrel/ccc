/**
 * Integration tests for Fiber SDK (channel, invoice, payment).
 * Requires a running native Fiber node via fiber-js (in-process). An HTTP bridge forwards JSON-RPC to it.
 * No mock fallback: if the node is unavailable, tests fail with a distinct FIBER_NODE_UNAVAILABLE error for bug fixing.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@joyid/ckb", () => ({
  verifySignature: async () => true,
  verifyCredential: async () => true,
}));

import { FiberSDK } from "./sdk.js";

const RPC_PORT = 18227;

/** Helper to build hex strings that satisfy `0x${string}` in param types. */
function hex(bytes: number): `0x${string}` {
  return ("0x" + "00".repeat(bytes)) as `0x${string}`;
}
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;

/** Distinct error code when the native Fiber node is not available (e.g. fiber-js failed to start). */
export const FIBER_NODE_UNAVAILABLE = "FIBER_NODE_UNAVAILABLE";

/** Distinct JSON-RPC error data type for Fiber invocation failures (for bug fixing). */
const FIBER_RPC_ERROR_TYPE = "FIBER_INVOKE_ERROR";

const MINIMAL_FIBER_CONFIG = `
fiber:
  listening_addr: "/ip4/127.0.0.1/tcp/8228"
  bootnode_addrs: []
  announce_listening_addr: false
  announced_addrs: []
  chain: testnet
  scripts: []
rpc:
  listening_addr: "127.0.0.1:8227"
ckb:
  rpc_url: "https://testnet.ckbapp.dev/"
  udt_whitelist: []
services:
  - fiber
  - rpc
  - ckb
`;

type FiberLike = {
  invokeCommand(name: string, args?: unknown[]): Promise<unknown>;
  start(
    config: string,
    fiberKeyPair: Uint8Array,
    ckbSecretKey: Uint8Array,
    chainSpec?: string,
    logLevel?: string,
    databasePrefix?: string,
  ): Promise<void>;
  stop(): Promise<void>;
};

let rpcServer: Server | null = null;
let fiberInstance: FiberLike | null = null;

function createRpcServer(fiber: FiberLike): Server {
  return createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/") {
      res.writeHead(404);
      res.end();
      return;
    }
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      void (async () => {
        let id: number;
        try {
          const payload = JSON.parse(body) as {
            jsonrpc: string;
            method: string;
            params?: unknown[];
            id: number;
          };
          const { method, params = [], id: payloadId } = payload;
          id = payloadId;
          res.setHeader("Content-Type", "application/json");

          const result = await fiber.invokeCommand(method, params);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              result: result,
              id,
            }),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          let errorId: number;
          try {
            errorId =
              typeof id === "number"
                ? id
                : (JSON.parse(body) as { id: number }).id;
          } catch {
            errorId = 0;
          }
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message,
                data: { type: FIBER_RPC_ERROR_TYPE, message },
              },
              id: errorId,
            }),
          );
        }
      })();
    });
  });
}

async function startFiberAndServer(): Promise<void> {
  let fiber: FiberLike;
  try {
    const mod = await import("@nervosnetwork/fiber-js");
    const { Fiber, randomSecretKey } = mod;
    const instance = new Fiber() as FiberLike;
    const fiberKey = randomSecretKey();
    const ckbKey = randomSecretKey();
    await instance.start(
      MINIMAL_FIBER_CONFIG,
      fiberKey,
      ckbKey,
      undefined,
      "info",
      "/wasm",
    );
    fiber = instance;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: native Fiber node could not be started. Integration tests require fiber-js to run in-process. Cause: ${cause}`,
    );
  }

  fiberInstance = fiber;
  await checkFiberAvailability(fiber);
  rpcServer = createRpcServer(fiber);
  await new Promise<void>((resolve, reject) => {
    rpcServer!.listen(RPC_PORT, "127.0.0.1", () => resolve());
    rpcServer!.on("error", reject);
  });
}

/** Verify the Fiber node responds to RPC; throws with FIBER_NODE_UNAVAILABLE if not. */
async function checkFiberAvailability(fiber: FiberLike): Promise<void> {
  try {
    await fiber.invokeCommand("list_channels", []);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: Fiber node did not respond to list_channels. Cause: ${cause}`,
    );
  }
}

async function stopServer(): Promise<void> {
  if (rpcServer) {
    await new Promise<void>((resolve) => {
      rpcServer!.close(() => resolve());
    });
    rpcServer = null;
  }
  if (fiberInstance) {
    try {
      await fiberInstance.stop();
    } catch {
      // ignore
    }
    fiberInstance = null;
  }
}

function createSdk(): FiberSDK {
  return new FiberSDK({ endpoint: RPC_URL, timeout: 10000 });
}

beforeAll(async () => {
  await startFiberAndServer();
}, 30000);

afterAll(async () => {
  await stopServer();
}, 5000);

describe("Fiber SDK", () => {
  describe("channel", () => {
    it("listChannels returns array", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels();
      expect(Array.isArray(channels)).toBe(true);
    });

    it("listChannels accepts optional params", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels({
        peerId: "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
        includeClosed: false,
      });
      expect(Array.isArray(channels)).toBe(true);
    });

    it("openChannel returns temporary channel id", async () => {
      const sdk = createSdk();
      const temporaryChannelId = await sdk.openChannel({
        peerId: "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
        fundingAmount: "0xba43b7400",
        public: true,
      });
      expect(typeof temporaryChannelId).toBe("string");
      expect(temporaryChannelId.length).toBeGreaterThan(0);
    });

    it("shutdownChannel accepts params", async () => {
      const sdk = createSdk();
      await expect(
        sdk.shutdownChannel({
          channelId: hex(32),
          feeRate: "0x3FC",
          force: false,
        }),
      ).resolves.not.toThrow();
    });

    it("abandonChannel accepts params object", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels();
      if (channels.length > 0) {
        const firstChannel = channels[0];
        const channelId =
          typeof firstChannel.channelId === "string"
            ? firstChannel.channelId
            : hex(32);
        await expect(sdk.abandonChannel({ channelId })).rejects.toThrow();
      } else {
        await expect(
          sdk.abandonChannel({ channelId: hex(32) }),
        ).rejects.toThrow();
      }
    });
  });

  describe("invoice", () => {
    it("newInvoice returns invoice address and invoice", async () => {
      const sdk = createSdk();
      const crypto = await import("node:crypto");
      const preimage = ("0x" +
        crypto.randomBytes(32).toString("hex")) as `0x${string}`;
      const result = await sdk.newInvoice({
        amount: "0x5f5e100",
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "test invoice",
        expiry: "0xe10",
        finalExpiryDelta: "0x28",
      });
      expect(result).toHaveProperty("invoiceAddress");
      expect(result).toHaveProperty("invoice");
      expect(result.invoice).toHaveProperty("data");
      expect(result.invoice.data).toHaveProperty("paymentHash");
    });

    it("parseInvoice returns invoice object", async () => {
      const sdk = createSdk();
      const invoice = await sdk.parseInvoice(
        "fibt1000000001pcsaug0p0exgfw0pnm6vk0rnt4xefskmrz0k2vqxr4lnrms60qasvc54jagg2hk8v40k88exmp04pn5cpcnrcsw5lk9w0w6l0m3k84e2ax4v6gq9ne2n77u4p8h3npx6tuufqftq8eyqxw9t4upaw4f89xukcee79rm0p0jv92d5ckq7pmvm09ma3psheu3rfyy9atlrdr4el6ys8yqurl2m74msuykljp35j0s47vpw8h3crfp5ldp8kp4xlusqk6rad3ssgwn2a429qlpgfgjrtj3gzy26w50cy7gypgjm6mjgaz2ff5q4am0avf6paxja2gh2wppjagqlg466yzty0r0pfz8qpuzqgq43mkgx",
      );
      expect(invoice).toHaveProperty("currency");
      expect(invoice).toHaveProperty("data");
      expect(invoice.data).toHaveProperty("paymentHash");
    });

    it("getInvoice returns status and invoice", async () => {
      const sdk = createSdk();
      const paymentHash = "0x" + "00".repeat(32);
      const result = await sdk.getInvoice(paymentHash);
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("invoiceAddress");
      expect(result).toHaveProperty("invoice");
    });

    it("cancelInvoice completes", async () => {
      const sdk = createSdk();
      const paymentHash = "0x" + "00".repeat(32);
      const result = await sdk.cancelInvoice(paymentHash);
      expect(result).toHaveProperty("status");
    });
  });

  describe("payment", () => {
    it("getPayment returns payment info", async () => {
      const sdk = createSdk();
      const payment = await sdk.getPayment("0x" + "00".repeat(32));
      expect(payment).toHaveProperty("paymentHash");
      expect(payment).toHaveProperty("status");
      expect(payment).toHaveProperty("fee");
    });

    it("buildRouter returns router hops", async () => {
      const sdk = createSdk();
      const result = await sdk.payment.buildRouter({
        hopsInfo: [{ pubkey: hex(33), channelOutpoint: hex(36) }],
      });
      expect(result).toHaveProperty("routerHops");
      expect(Array.isArray(result.routerHops)).toBe(true);
    });

    it("sendPayment with invoice string", async () => {
      const sdk = createSdk();
      const result = await sdk.sendPayment({
        invoice:
          "fibt1000000001pcsaug0p0exgfw0pnm6vkkya5ul6wxurhh09qf9tuwwaufqnr3uzwpplgcrjpeuhe6w4rudppfkytvm4jekf6ymmwqk2h0ajvr5uhjpwfd9aga09ahpy88hz2um4l9t0xnpk3m9wlf22m2yjcshv3k4g5x7c68fn0gs6a35dw5r56cc3uztyf96l55ayeuvnd9fl4yrt68y086xn6qgjhf4n7xkml62gz5ecypm3xz0wdd59tfhtrhwvp5qlps959vmpf4jygdkspxn8xalparwj8h9ts6v6v0rf7vvhhku40z9sa4txxmgsjzwqzme4ddazxrfrlkc9m4uysh27zgqlx7jrfgvjw7rcqpmsrlga",
      });
      expect(result).toHaveProperty("paymentHash");
      expect(result).toHaveProperty("status");
      expect(typeof result.paymentHash).toBe("string");
      expect(typeof result.status).toBe("string");
    });
  });
});
