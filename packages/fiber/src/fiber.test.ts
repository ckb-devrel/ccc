/**
 * Integration tests for Fiber SDK (channel, invoice, payment).
 * Requires a running Fiber node: set FIBER_RPC_URL to an existing node's RPC URL, or run in an environment
 * where fiber-js can start in-process (e.g. browser). No mock fallback; distinct FIBER_NODE_UNAVAILABLE on failure.
 */
import { Fiber, randomSecretKey } from "@nervosnetwork/fiber-js";
import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FiberSDK } from "./sdk.js";

vi.mock("@joyid/ckb", () => ({
  verifySignature: async () => true,
  verifyCredential: async () => true,
}));

const RPC_PORT = 18227;

/** Helper to build hex strings that satisfy `0x${string}` in param types. */
function hex(bytes: number): `0x${string}` {
  return ("0x" + "00".repeat(bytes)) as `0x${string}`;
}

/** Get a readable cause string from an unknown error. */
function errorCause(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ? `${err.message}\n${err.stack}` : err.message;
  }
  const obj =
    err && typeof err === "object" ? (err as Record<string, unknown>) : {};
  if (typeof obj.message === "string") return obj.message;
  return JSON.stringify(err);
}

/** Get JSON-RPC id from body string, or fallback. */
function getJsonRpcId(body: string, fallback: number): number {
  try {
    const parsed = JSON.parse(body) as { id?: number };
    return typeof parsed.id === "number" ? parsed.id : fallback;
  } catch {
    return fallback;
  }
}

/** Normalize parse_invoice result: RPC may return { invoice } or the invoice object directly. */
function getInvoiceFromParseResult(result: unknown): {
  currency?: string;
  data?: { paymentHash?: string };
} {
  const obj =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  return typeof obj.invoice === "object" && obj.invoice !== null
    ? (obj.invoice as { currency?: string; data?: { paymentHash?: string } })
    : (result as { currency?: string; data?: { paymentHash?: string } });
}

/** RPC base URL: FIBER_RPC_URL env if set, otherwise our in-process bridge. */
let RPC_URL: string = `http://127.0.0.1:${RPC_PORT}`;

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
        let id: number | undefined;
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
          const errorId = id ?? getJsonRpcId(body, 0);
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

/** Check availability of an external Fiber node via HTTP RPC. */
async function checkExternalFiberAvailability(url: string): Promise<void> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "list_channels",
    params: [{}],
    id: 1,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: Fiber node at ${url} returned HTTP ${res.status}.`,
    );
  }
  const data = (await res.json()) as {
    error?: { message?: string };
    result?: unknown;
  };
  if (data.error) {
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: Fiber node at ${url} returned error: ${data.error.message ?? JSON.stringify(data.error)}.`,
    );
  }
}

async function startFiberAndServer(): Promise<void> {
  const externalUrl = process.env.FIBER_RPC_URL?.trim();
  if (externalUrl) {
    RPC_URL = externalUrl.replace(/\/$/, "");
    await checkExternalFiberAvailability(RPC_URL);
    return;
  }

  let fiber: FiberLike;
  try {
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
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: native Fiber node could not be started. Set FIBER_RPC_URL to an existing node's RPC URL, or run in an environment where fiber-js works (e.g. browser). Cause: ${errorCause(err)}`,
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

/** Verify the in-process Fiber node responds to RPC; throws with FIBER_NODE_UNAVAILABLE if not. */
async function checkFiberAvailability(fiber: FiberLike): Promise<void> {
  try {
    await fiber.invokeCommand("list_channels", [{}]);
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
}, 60000);

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

    it("openChannel returns temporary channel id or rejects when peer unavailable", async () => {
      const sdk = createSdk();
      await expect(
        sdk.openChannel({
          peerId: "QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo",
          fundingAmount: "0xba43b7400",
          public: true,
        }),
      ).rejects.toThrow();
      // In isolated node there is no peer; openChannel rejects. If we had a peer, we'd get a string channel id.
    });

    it("shutdownChannel accepts params and rejects when channel not found", async () => {
      const sdk = createSdk();
      await expect(
        sdk.shutdownChannel({
          channelId: hex(32),
          feeRate: "0x3FC",
          force: false,
        }),
      ).rejects.toThrow();
      // Non-existent channel id; node returns "Channel not found".
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
      const preimage = ("0x" +
        crypto.randomBytes(32).toString("hex")) as `0x${string}`;
      const result = await sdk.newInvoice({
        amount: "0x5f5e100",
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "test invoice",
        expiry: "0xe10",
        finalExpiryDelta: "0x9283C0",
      });
      expect(result).toHaveProperty("invoiceAddress");
      expect(result).toHaveProperty("invoice");
      expect(result.invoice).toHaveProperty("data");
      expect(result.invoice.data).toHaveProperty("paymentHash");
    });

    it("parseInvoice returns invoice object", async () => {
      const sdk = createSdk();
      const result = await sdk.parseInvoice(
        "fibt1000000001pcsaug0p0exgfw0pnm6vk0rnt4xefskmrz0k2vqxr4lnrms60qasvc54jagg2hk8v40k88exmp04pn5cpcnrcsw5lk9w0w6l0m3k84e2ax4v6gq9ne2n77u4p8h3npx6tuufqftq8eyqxw9t4upaw4f89xukcee79rm0p0jv92d5ckq7pmvm09ma3psheu3rfyy9atlrdr4el6ys8yqurl2m74msuykljp35j0s47vpw8h3crfp5ldp8kp4xlusqk6rad3ssgwn2a429qlpgfgjrtj3gzy26w50cy7gypgjm6mjgaz2ff5q4am0avf6paxja2gh2wppjagqlg466yzty0r0pfz8qpuzqgq43mkgx",
      );
      const invoice = getInvoiceFromParseResult(result);
      expect(invoice).toHaveProperty("currency");
      expect(invoice).toHaveProperty("data");
      expect(invoice.data).toHaveProperty("paymentHash");
    });

    it("getInvoice rejects when invoice not found", async () => {
      const sdk = createSdk();
      const paymentHash = "0x" + "00".repeat(32);
      await expect(sdk.getInvoice(paymentHash)).rejects.toThrow();
    });

    it("cancelInvoice rejects when invoice not found", async () => {
      const sdk = createSdk();
      const paymentHash = "0x" + "00".repeat(32);
      await expect(sdk.cancelInvoice(paymentHash)).rejects.toThrow();
    });
  });

  describe("payment", () => {
    it("getPayment rejects when payment session not found", async () => {
      const sdk = createSdk();
      await expect(sdk.getPayment("0x" + "00".repeat(32))).rejects.toThrow();
    });

    it("buildRouter rejects when no path found", async () => {
      const sdk = createSdk();
      await expect(
        sdk.payment.buildRouter({
          hopsInfo: [{ pubkey: hex(33), channelOutpoint: hex(36) }],
        }),
      ).rejects.toThrow();
      // Isolated node has no graph path for dummy hop.
    });

    it("sendPayment rejects when invoice invalid or expired", async () => {
      const sdk = createSdk();
      await expect(
        sdk.sendPayment({
          invoice:
            "fibt1000000001pcsaug0p0exgfw0pnm6vkkya5ul6wxurhh09qf9tuwwaufqnr3uzwpplgcrjpeuhe6w4rudppfkytvm4jekf6ymmwqk2h0ajvr5uhjpwfd9aga09ahpy88hz2um4l9t0xnpk3m9wlf22m2yjcshv3k4g5x7c68fn0gs6a35dw5r56cc3uztyf96l55ayeuvnd9fl4yrt68y086xn6qgjhf4n7xkml62gz5ecypm3xz0wdd59tfhtrhwvp5qlps959vmpf4jygdkspxn8xalparwj8h9ts6v6v0rf7vvhhku40z9sa4txxmgsjzwqzme4ddazxrfrlkc9m4uysh27zgqlx7jrfgvjw7rcqpmsrlga",
        }),
      ).rejects.toThrow();
    });
  });
});
