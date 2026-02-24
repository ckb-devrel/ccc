/**
 * Integration tests for Fiber SDK (channel, invoice, payment).
 * When running in-process: starts two Fiber nodes (A and B) so tests can target either node; node A at RPC_PORT_A,
 * node B at RPC_PORT_B. When FIBER_RPC_URL is set: uses that single node for all tests. No mock fallback;
 * distinct FIBER_NODE_UNAVAILABLE on failure.
 */
import { ccc } from "@ckb-ccc/core";
import { Fiber, randomSecretKey } from "@nervosnetwork/fiber-js";
import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FiberSDK } from "./sdk.js";

vi.mock("@joyid/ckb", () => ({
  verifySignature: async () => true,
  verifyCredential: async () => true,
}));

const RPC_PORT_A = 18227;
const RPC_PORT_B = 18229;

/** Fixed8 scale (8 decimals). Caller is responsible for scaling amounts. */
const FIXED8_SCALE = 10n ** 8n;
/** Channel test funding amount in fixed8: 500 × 10^8. */
const CHANNEL_TEST_FUNDING_AMOUNT_FIXED8 = ccc.numToHex(500n * FIXED8_SCALE);
/** Channel test fee rate (shannons per kw). */
const CHANNEL_TEST_FEE_RATE = 1020;
/** Invoice test amount (e.g. 100M minimal units). */
const INVOICE_TEST_AMOUNT = 100_000_000;
/** Invoice test expiry (seconds, e.g. 3600 = 1 hour). */
const INVOICE_TEST_EXPIRY_SEC = 3600;
/** Invoice test final HTLC expiry delta. */
const INVOICE_TEST_FINAL_EXPIRY_DELTA = 9_600_000;

/** Helper to build hex strings (ccc.Hex) for param types. */
function hex(bytes: number): ccc.Hex {
  return ("0x" + "00".repeat(bytes)) as ccc.Hex;
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

/** RPC base URL(s): FIBER_RPC_URL env if set (single node), otherwise our in-process two-node bridge. */
let RPC_URL: string = `http://127.0.0.1:${RPC_PORT_A}`;
let RPC_URL_B: string = `http://127.0.0.1:${RPC_PORT_B}`;

/** Distinct error code when the native Fiber node is not available (e.g. fiber-js failed to start). */
export const FIBER_NODE_UNAVAILABLE = "FIBER_NODE_UNAVAILABLE";

const FIBER_RPC_ERROR_TYPE = "FIBER_INVOKE_ERROR";

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

type NodeConfig = {
  fiberPort: number;
  rpcPort: number;
  databasePrefix: string;
  bootnodeAddrs?: string[];
};

let rpcServer: Server | null = null;
let rpcServerB: Server | null = null;
let fiberInstance: FiberLike | null = null;
let fiberInstanceB: FiberLike | null = null;
let twoNodesMode = false;
let nodeBPeerId: string | null = null;

function fiberConfig(c: NodeConfig): string {
  const bootnodeYaml =
    (c.bootnodeAddrs?.length ?? 0) === 0
      ? "  bootnode_addrs: []"
      : `  bootnode_addrs:\n${c.bootnodeAddrs!.map((a) => `    - "${a}"`).join("\n")}`;
  return `
fiber:
  listening_addr: "/ip4/127.0.0.1/tcp/${c.fiberPort}"
${bootnodeYaml}
  announce_listening_addr: false
  announced_addrs: []
  chain: testnet
  scripts: []
rpc:
  listening_addr: "127.0.0.1:${c.rpcPort}"
ckb:
  rpc_url: "https://testnet.ckbapp.dev/"
  udt_whitelist: []
services:
  - fiber
  - rpc
  - ckb
`.trim();
}

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
            method: string;
            params?: unknown[];
            id: number;
          };
          const { method, params = [], id: payloadId } = payload;
          id = payloadId;
          res.setHeader("Content-Type", "application/json");
          const result = await fiber.invokeCommand(method, params);
          res.end(JSON.stringify({ jsonrpc: "2.0", result, id }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message,
                data: { type: FIBER_RPC_ERROR_TYPE, message },
              },
              id: id ?? getJsonRpcId(body, 0),
            }),
          );
        }
      })();
    });
  });
}

function listenPromise(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
}

/** Call raw JSON-RPC (snake_case) and return result. Used for node_info, connect_peer. */
async function rpcCall(
  baseUrl: string,
  method: string,
  params: unknown[] = [],
): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
    params,
    id: 1,
  });
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const data = (await res.json()) as {
    error?: { message?: string };
    result?: unknown;
  };
  if (data.error)
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data.result;
}

/** Get node_id and addresses from node_info; build p2p address from port if none returned. */
async function getNodeInfo(
  baseUrl: string,
  fiberPort?: number,
): Promise<{ nodeId: string; addresses: string[] }> {
  const obj = (await rpcCall(baseUrl, "node_info", []).catch(
    () => null,
  )) as Record<string, unknown> | null;
  const rawId = obj?.node_id ?? obj?.nodeId;
  const nodeId = typeof rawId === "string" ? rawId : "";
  let addresses: string[] =
    obj && Array.isArray(obj.addresses) ? (obj.addresses as string[]) : [];
  if (addresses.length === 0 && nodeId && fiberPort != null) {
    addresses = [`/ip4/127.0.0.1/tcp/${fiberPort}/p2p/${nodeId}`];
  }
  return { nodeId, addresses };
}

async function checkExternalFiberAvailability(url: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "list_channels",
      params: [{}],
      id: 1,
    }),
  });
  if (!res.ok)
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: ${url} returned HTTP ${res.status}`,
    );
  const data = (await res.json()) as { error?: { message?: string } };
  if (data.error)
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: ${data.error.message ?? JSON.stringify(data.error)}`,
    );
}

/** Start one Fiber node + RPC server; throws with FIBER_NODE_UNAVAILABLE on failure. */
async function startOneNode(
  config: NodeConfig,
  rpcPort: number,
): Promise<{
  fiber: FiberLike;
  server: Server;
  url: string;
  nodeInfo: { nodeId: string; addresses: string[] };
}> {
  const fiber = new Fiber() as FiberLike;
  await fiber
    .start(
      fiberConfig(config),
      randomSecretKey(),
      randomSecretKey(),
      undefined,
      "info",
      config.databasePrefix,
    )
    .catch((err) => {
      throw new Error(
        `${FIBER_NODE_UNAVAILABLE}: Fiber could not start. Cause: ${errorCause(err)}`,
      );
    });
  await fiber.invokeCommand("list_channels", [{}]).catch((err) => {
    throw new Error(
      `${FIBER_NODE_UNAVAILABLE}: list_channels failed. ${err instanceof Error ? err.message : err}`,
    );
  });
  const server = createRpcServer(fiber);
  await listenPromise(server, rpcPort);
  const url = `http://127.0.0.1:${rpcPort}`;
  const nodeInfo = await getNodeInfo(url, config.fiberPort);
  return { fiber, server, url, nodeInfo };
}

function closeServer(s: Server | null): Promise<void> {
  if (!s) return Promise.resolve();
  return new Promise((resolve) => s.close(() => resolve()));
}

async function stopFiber(f: FiberLike | null): Promise<void> {
  if (f)
    try {
      await f.stop();
    } catch {
      /* ignore */
    }
}

async function startFiberAndServer(): Promise<void> {
  const externalUrl = process.env.FIBER_RPC_URL?.trim();
  if (externalUrl) {
    RPC_URL = RPC_URL_B = externalUrl.replace(/\/$/, "");
    await checkExternalFiberAvailability(RPC_URL);
    return;
  }

  twoNodesMode = true;
  const nodeA = await startOneNode(
    { fiberPort: 8228, rpcPort: 8227, databasePrefix: "/wasm-a" },
    RPC_PORT_A,
  );
  fiberInstance = nodeA.fiber;
  rpcServer = nodeA.server;
  RPC_URL = nodeA.url;

  const bootnodeAddr =
    nodeA.nodeInfo.addresses.find((a) => a.includes("/p2p/Qm")) ??
    nodeA.nodeInfo.addresses[0];
  const nodeB = await startOneNode(
    {
      fiberPort: 8230,
      rpcPort: 8229,
      databasePrefix: "/wasm-b",
      bootnodeAddrs: bootnodeAddr?.includes("Qm") ? [bootnodeAddr] : [],
    },
    RPC_PORT_B,
  );
  fiberInstanceB = nodeB.fiber;
  rpcServerB = nodeB.server;
  RPC_URL_B = nodeB.url;

  nodeBPeerId = nodeB.nodeInfo.nodeId.startsWith("Qm")
    ? nodeB.nodeInfo.nodeId
    : null;
  const nodeBAddr = nodeB.nodeInfo.addresses.find((a) => a.includes("/p2p/Qm"));
  if (nodeBAddr)
    await rpcCall(RPC_URL, "connect_peer", [{ address: nodeBAddr }]).catch(
      () => {},
    );
}

async function stopServer(): Promise<void> {
  await closeServer(rpcServerB);
  rpcServerB = null;
  await closeServer(rpcServer);
  rpcServer = null;
  await stopFiber(fiberInstanceB);
  fiberInstanceB = null;
  await stopFiber(fiberInstance);
  fiberInstance = null;
  twoNodesMode = false;
}

function createSdk(): FiberSDK {
  return new FiberSDK({ endpoint: RPC_URL, timeout: 10000 });
}

function createSdkB(): FiberSDK {
  return new FiberSDK({ endpoint: RPC_URL_B, timeout: 10000 });
}

beforeAll(async () => {
  await startFiberAndServer();
}, 60000);

afterAll(async () => {
  await stopServer();
}, 5000);

describe("Fiber SDK", () => {
  describe("info", () => {
    it("getNodeInfo returns nodeId and addresses", async () => {
      const sdk = createSdk();
      const info = await sdk.getNodeInfo();
      expect(info).toHaveProperty("nodeId");
      expect(typeof info.nodeId).toBe("string");
      expect(info).toHaveProperty("addresses");
      expect(Array.isArray(info.addresses)).toBe(true);
    });
  });

  // Channel tests run in definition order (sequence.shuffle: false). Two distinct channel creations: one Ready (for shutdown), one pending (for abandon). Then list, then shutdown, abandon.
  describe("channel", () => {
    let channelIdForShutdown: ccc.Hex | null = null; // Ready channel from open + accept
    let channelIdForAbandon: ccc.Hex | null = null; // Pending channel from open only

    it("openChannel and acceptChannel create Ready channel for shutdown", async () => {
      if (!twoNodesMode || !nodeBPeerId) {
        return;
      }
      const sdkA = createSdk();
      const sdkB = createSdkB();
      const tempId = await sdkA.openChannel({
        peerId: nodeBPeerId,
        fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
        public: true,
      });
      expect(tempId).toMatch(/^0x[a-fA-F0-9]+$/);
      const readyChannelId = await sdkB.channel.acceptChannel({
        temporaryChannelId: tempId,
        fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
      });
      channelIdForShutdown = readyChannelId;
    });

    it("openChannel without accept creates pending channel for abandon", async () => {
      if (!twoNodesMode || !nodeBPeerId) {
        return;
      }
      const sdkA = createSdk();
      const tempId = await sdkA.openChannel({
        peerId: nodeBPeerId,
        fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
        public: true,
      });
      expect(tempId).toMatch(/^0x[a-fA-F0-9]+$/);
      channelIdForAbandon = tempId;
    });

    it("listChannels returns array", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels();
      expect(Array.isArray(channels)).toBe(true);
      if (twoNodesMode) {
        const channelsB = await createSdkB().listChannels();
        expect(Array.isArray(channelsB)).toBe(true);
      }
    });

    it("listChannels accepts optional params", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels({ includeClosed: false });
      expect(Array.isArray(channels)).toBe(true);
    });

    it("shutdownChannel for the Ready channel", async () => {
      if (channelIdForShutdown == null) {
        return;
      }
      const sdk = createSdk();
      await sdk.shutdownChannel({
        channelId: channelIdForShutdown,
        feeRate: CHANNEL_TEST_FEE_RATE,
        force: false,
      });
    });

    it("abandonChannel for the pending channel", async () => {
      if (channelIdForAbandon == null) {
        return;
      }
      const sdk = createSdk();
      await sdk.abandonChannel({ channelId: channelIdForAbandon });
    });
  });

  describe("invoice", () => {
    it("newInvoice returns invoice address and invoice", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const result = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "test invoice",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      expect(result).toHaveProperty("invoiceAddress");
      expect(result).toHaveProperty("invoice");
      expect(result.invoice).toHaveProperty("data");
      expect(result.invoice.data).toHaveProperty("paymentHash");
    });

    it("parseInvoice returns invoice object", async () => {
      const sdk = createSdk();
      const result = await sdk.parseInvoice({
        invoice:
          "fibt1000000001pcsaug0p0exgfw0pnm6vk0rnt4xefskmrz0k2vqxr4lnrms60qasvc54jagg2hk8v40k88exmp04pn5cpcnrcsw5lk9w0w6l0m3k84e2ax4v6gq9ne2n77u4p8h3npx6tuufqftq8eyqxw9t4upaw4f89xukcee79rm0p0jv92d5ckq7pmvm09ma3psheu3rfyy9atlrdr4el6ys8yqurl2m74msuykljp35j0s47vpw8h3crfp5ldp8kp4xlusqk6rad3ssgwn2a429qlpgfgjrtj3gzy26w50cy7gypgjm6mjgaz2ff5q4am0avf6paxja2gh2wppjagqlg466yzty0r0pfz8qpuzqgq43mkgx",
      });
      const invoice = getInvoiceFromParseResult(result);
      expect(invoice).toHaveProperty("currency");
      expect(invoice).toHaveProperty("data");
      expect(invoice.data).toHaveProperty("paymentHash");
    });

    it("getInvoice returns invoice when it exists", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "getInvoice test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      const paymentHash = created.invoice.data.paymentHash;
      const got = await sdk.getInvoice(paymentHash);
      expect(got).toHaveProperty("status");
      expect(got).toHaveProperty("invoice");
      expect(got.invoice.data.paymentHash).toBe(paymentHash);
    });

    it("cancelInvoice succeeds when invoice exists", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "cancelInvoice test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      const paymentHash = created.invoice.data.paymentHash;
      const result = await sdk.cancelInvoice(paymentHash);
      expect(result).toHaveProperty("status");
    });
  });

  describe("payment", () => {
    let paymentHashFromSend: ccc.Hex | null = null; // Set by sendPayment test for getPayment to verify

    it("buildRouter succeeds when channel graph has path", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels();
      if (channels.length === 0) {
        return; // No channels; do not call to avoid "no path" error log
      }
      const ch = channels[0] as {
        peerId?: string;
        counterpartyNodeId?: string;
        channelOutpoint?: string;
      };
      const pubkey = ch.counterpartyNodeId ?? ch.peerId;
      const outpoint = ch.channelOutpoint ?? hex(36);
      if (!pubkey) {
        return;
      }
      // Only call when we have real channel; may still get "no path" if graph has no route
      const router = await sdk.payment.buildRouter({
        hopsInfo: [{ pubkey, channelOutpoint: ccc.hexFrom(outpoint) }],
      });
      expect(router).toBeDefined();
    });

    it("sendPayment succeeds with valid invoice when path exists", async () => {
      const sdk = createSdk();
      const channels = await sdk.listChannels();
      if (channels.length === 0) {
        return;
      }
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "sendPayment test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      const result = await sdk.sendPayment({
        invoice: created.invoiceAddress,
      });
      expect(result).toBeDefined();
      paymentHashFromSend =
        (result as { paymentHash?: ccc.Hex }).paymentHash ??
        created.invoice.data.paymentHash;
    });

    it("getPayment returns payment when session exists after sendPayment", async () => {
      if (paymentHashFromSend == null) {
        return;
      }
      const sdk = createSdk();
      const payment = await sdk.getPayment(paymentHashFromSend);
      expect(payment).toHaveProperty("paymentHash");
      expect(payment).toHaveProperty("status");
      expect(payment.paymentHash).toBe(paymentHashFromSend);
    });
  });

  describe("failure scenarios", () => {
    describe("channel", () => {
      it("openChannel rejects when peer is not connected", async () => {
        const sdk = createSdk();
        await expect(
          sdk.openChannel({
            peerId: "QmNonExistentPeer000000000000000000000000000",
            fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
            public: true,
          }),
        ).rejects.toThrow();
      });

      it("shutdownChannel rejects when channel does not exist", async () => {
        const sdk = createSdk();
        await expect(
          sdk.shutdownChannel({
            channelId: hex(32),
            feeRate: CHANNEL_TEST_FEE_RATE,
            force: false,
          }),
        ).rejects.toThrow();
      });

      it("abandonChannel rejects when channel does not exist", async () => {
        const sdk = createSdk();
        await expect(
          sdk.abandonChannel({ channelId: hex(32) }),
        ).rejects.toThrow();
      });
    });

    describe("invoice", () => {
      it("getInvoice rejects when payment hash not found", async () => {
        const sdk = createSdk();
        await expect(sdk.getInvoice(hex(32))).rejects.toThrow();
      });

      it("cancelInvoice rejects when invoice not found", async () => {
        const sdk = createSdk();
        await expect(sdk.cancelInvoice(hex(32))).rejects.toThrow();
      });

      it("parseInvoice rejects when invoice string is invalid", async () => {
        const sdk = createSdk();
        await expect(
          sdk.parseInvoice({ invoice: "invalid-invoice-string" }),
        ).rejects.toThrow();
      });
    });

    describe("payment", () => {
      it("getPayment rejects when payment session not found", async () => {
        const sdk = createSdk();
        await expect(sdk.getPayment(hex(32))).rejects.toThrow();
      });

      it("buildRouter rejects when no path found", async () => {
        const sdk = createSdk();
        await expect(
          sdk.payment.buildRouter({
            hopsInfo: [{ pubkey: hex(33), channelOutpoint: hex(36) }],
          }),
        ).rejects.toThrow();
      });

      it("sendPayment rejects when invoice is expired or invalid", async () => {
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
});
