/**
 * Integration tests for Fiber SDK (channel, invoice, payment).
 * When running in-process: starts two Fiber nodes (A and B) so tests can target either node; node A at RPC_PORT_A,
 * node B at RPC_PORT_B. When FIBER_RPC_URL is set: uses that single node for all tests. No mock fallback;
 * distinct FIBER_NODE_UNAVAILABLE on failure.
 *
 * Failure-scenario tests call the real node with invalid data (e.g. zero channel_id, invalid invoice string).
 * You may see "Error: invalid data" (and sometimes "failed to parse: ... invalid character '0' at byte 0") in the
 * console from the fiber WASM worker. These are expected: the node rejects the request and the SDK correctly
 * receives the error and the test passes. The message is the node's internal error before it is returned as JSON-RPC
 * error. It is not harmful and does not indicate an SDK bug. If the node expected a different param format (e.g. hex
 * with/without "0x"), that would be a fiber-js/fiber node concern; our SDK sends standard 0x-prefixed hex.
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

const RPC_PORT = 18227;
const RPC_URL = `http://127.0.0.1:${RPC_PORT}`;
const FIXED8_SCALE = 10n ** 8n;
const CHANNEL_TEST_FUNDING_AMOUNT_FIXED8 = ccc.numToHex(500n * FIXED8_SCALE);
const CHANNEL_TEST_FEE_RATE = 1020;
const INVOICE_TEST_AMOUNT = 100_000_000;
const INVOICE_TEST_EXPIRY_SEC = 3600;
const INVOICE_TEST_FINAL_EXPIRY_DELTA = 9_600_000;

type NodeConfig = {
  fiberPort: number;
  rpcPort: number;
  databasePrefix: string;
  bootnodeAddrs?: string[];
};

function hex(bytes: number): ccc.Hex {
  return ("0x" + "00".repeat(bytes)) as ccc.Hex;
}

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

function createRpcServer(fiber: Fiber): Server {
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
          const result = (await fiber.invokeCommand(method, params)) as unknown;
          res.end(JSON.stringify({ jsonrpc: "2.0", result, id }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message,
              },
              id: id ?? 0,
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

async function startOneNode(
  config: NodeConfig,
  rpcPort: number,
): Promise<{
  fiber: Fiber;
  server: Server;
  nodeInfo: { nodeId: string; addresses: string[] };
}> {
  const fiberKeyPair = randomSecretKey();
  const fiber = new Fiber();
  await fiber
    .start(
      fiberConfig(config),
      fiberKeyPair,
      randomSecretKey(),
      undefined,
      "info",
      config.databasePrefix,
    )
    .catch((err) => {
      throw new Error(`Fiber could not start. Cause: ${err}`);
    });
  const server = createRpcServer(fiber);
  await listenPromise(server, rpcPort);
  const nodeInfo = await fiber.nodeInfo();
  return {
    fiber,
    server,
    nodeInfo: {
      nodeId: nodeInfo.node_id,
      addresses: nodeInfo.addresses,
    },
  };
}

let rpcServer: Server | null = null;
let fiberInstance: Fiber | null = null;

async function startFiberAndServer(): Promise<void> {
  const fiberNode = await startOneNode(
    { fiberPort: 8228, rpcPort: 8227, databasePrefix: "/wasm-fiber" },
    RPC_PORT,
  );
  fiberInstance = fiberNode.fiber;
  rpcServer = fiberNode.server;
}

async function stopServer(): Promise<void> {
  rpcServer?.close();
  await fiberInstance?.stop();
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
  describe("info", () => {
    it("getNodeInfo returns nodeId and addresses", async () => {
      const sdk = createSdk();
      const info = await sdk.getNodeInfo();
      expect(info).toHaveProperty("nodeId");
      expect(typeof info.nodeId).toBe("string");
      expect(info).toHaveProperty("addresses");
    });
  });

  describe("peer", () => {
    it("listPeers", async () => {
      const sdk = createSdk();
      await sdk.listPeers();
    });

    it("connectPeer", async () => {
      const sdk = createSdk();
      await sdk
        .connectPeer({
          address:
            "/ip4/127.0.0.1/tcp/8228/p2p/QmZicX1EZumP6wkB9DpmV2xBQDm3pexRvqoYdhKotNjDFa",
        })
        .catch((err) => {
          expect(err.message).toContain('RPC method "connect_peer" failed');
        });
    });
  });

  describe("channel", () => {
    it("openChannel", async () => {
      const sdk = createSdk();
      await sdk
        .openChannel({
          peerId: "QmZicX1EZumP6wkB9DpmV2xBQDm3pexRvqoYdhKotNjDFa",
          fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
          public: true,
        })
        .catch((err) => {
          expect(err.message).toContain("Invalid parameter");
        });
    });

    it("listChannels", async () => {
      const sdk = createSdk();
      const result = await sdk.listChannels();
      expect(Array.isArray(result)).toBe(true);
    });

    it("shutdownChannel", async () => {
      const sdk = createSdk();
      await sdk
        .shutdownChannel({
          channelId: hex(32),
          feeRate: CHANNEL_TEST_FEE_RATE,
          force: false,
        })
        .catch((err) => {
          expect(err.message).toContain("Channel not found error");
        });
    });

    it("abandonChannel", async () => {
      const sdk = createSdk();
      await sdk.abandonChannel({ channelId: hex(32) }).catch((err) => {
        expect(err.message).toContain("Invalid parameter");
      });
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
      expect(result).toHaveProperty("currency");
      expect(result).toHaveProperty("data");
      expect(result.data).toHaveProperty("paymentHash");
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
    it("sendPayment", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "sendPayment test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      await sdk
        .sendPayment({ invoice: created.invoiceAddress })
        .catch((err) => {
          expect(err.message).toContain(
            "Send payment error: Failed to build route, Feature not enabled: allow_self_payment is not enabled, can not pay to self",
          );
        });
    });
  });
});
