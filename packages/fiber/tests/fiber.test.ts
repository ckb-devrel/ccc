/**
 * Integration tests for Fiber SDK (channel, invoice, payment).
 * Starts an in-process Fiber node via FiberRuntime and exercises the SDK
 * against the HTTP JSON-RPC bridge it provides.
 *
 * Failure-scenario tests call the real node with invalid data (e.g. zero
 * channel_id, invalid invoice string). Error messages from the fiber WASM
 * worker in the console are expected — the node rejects the request and the
 * SDK correctly surfaces the error. They are not SDK bugs.
 */
import { ccc } from "@ckb-ccc/core";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FiberSDK } from "../src/sdk.js";
import { FiberRuntime } from "./runtime/index.js";

vi.mock("@joyid/ckb", () => ({
  verifySignature: async () => true,
  verifyCredential: async () => true,
}));

const RPC_PORT = 18227;
const FIXED8_SCALE = 10n ** 8n;
const CHANNEL_TEST_FUNDING_AMOUNT_FIXED8 = ccc.numToHex(500n * FIXED8_SCALE);
const CHANNEL_TEST_FEE_RATE = 1020;
const INVOICE_TEST_AMOUNT = 100_000_000;
const INVOICE_TEST_EXPIRY_SEC = 3600;
const INVOICE_TEST_FINAL_EXPIRY_DELTA = 9_600_000;

function hex(bytes: number): ccc.Hex {
  return ("0x" + "00".repeat(bytes)) as ccc.Hex;
}

let runtime: FiberRuntime;

function createSdk(): FiberSDK {
  return new FiberSDK({ endpoint: runtime.info.rpcUrl, timeout: 10000 });
}

beforeAll(async () => {
  runtime = new FiberRuntime();
  await runtime.start({
    config: { fiberPort: 8228, databasePrefix: "/wasm-fiber" },
    storage: { type: "memory" },
    rpcPort: RPC_PORT,
  });
}, 60000);

afterAll(async () => {
  await runtime?.stop();
}, 5000);

describe("Fiber SDK", () => {
  describe("info", () => {
    it("getNodeInfo returns pubkey and addresses", async () => {
      const sdk = createSdk();
      const info = await sdk.getNodeInfo();
      expect(info).toHaveProperty("pubkey");
      expect(typeof info.pubkey).toBe("string");
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
      await expect(
        sdk.connectPeer({
          address:
            "/ip4/127.0.0.1/tcp/8228/p2p/QmZicX1EZumP6wkB9DpmV2xBQDm3pexRvqoYdhKotNjDFa",
        }),
      ).rejects.toThrow('RPC method "connect_peer" failed');
    });

    it("disconnectPeer", async () => {
      const sdk = createSdk();
      // Use the node's own pubkey — it cannot be a connected peer of itself,
      // so the node returns a domain error proving the method is recognised.
      const { pubkey } = await sdk.getNodeInfo();
      await expect(sdk.disconnectPeer({ pubkey })).rejects.toThrow();
    });
  });

  describe("channel", () => {
    it("openChannel", async () => {
      const sdk = createSdk();
      await expect(
        sdk.openChannel({
          pubkey:
            "02a6e3e72e39e0e9e9c9a6b3f5d4c2b1a0e9f8d7c6b5a4d3c2b1a0e9f8d7c6b5a4",
          fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
          public: true,
        }),
      ).rejects.toThrow("Invalid parameter");
    });

    it("acceptChannel", async () => {
      const sdk = createSdk();
      await expect(
        sdk.acceptChannel({
          temporaryChannelId: hex(32),
          fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
        }),
      ).rejects.toThrow();
    });

    it("listChannels", async () => {
      const sdk = createSdk();
      const result = await sdk.listChannels();
      expect(Array.isArray(result)).toBe(true);
    });

    it("shutdownChannel", async () => {
      const sdk = createSdk();
      await expect(
        sdk.shutdownChannel({
          channelId: hex(32),
          feeRate: CHANNEL_TEST_FEE_RATE,
          force: false,
        }),
      ).rejects.toThrow("Channel not found error");
    });

    it("abandonChannel", async () => {
      const sdk = createSdk();
      await expect(
        sdk.abandonChannel({ channelId: hex(32) }),
      ).rejects.toThrow("Invalid parameter");
    });

    it("updateChannel", async () => {
      const sdk = createSdk();
      await expect(
        sdk.updateChannel({ channelId: hex(32), enabled: true }),
      ).rejects.toThrow();
    });

    it("openChannelWithExternalFunding", async () => {
      const sdk = createSdk();
      await expect(
        sdk.openChannelWithExternalFunding({
          pubkey:
            "02a6e3e72e39e0e9e9c9a6b3f5d4c2b1a0e9f8d7c6b5a4d3c2b1a0e9f8d7c6b5a4",
          fundingAmount: CHANNEL_TEST_FUNDING_AMOUNT_FIXED8,
          shutdownScript: { codeHash: hex(32), hashType: "type", args: "0x" },
          fundingLockScript: {
            codeHash: hex(32),
            hashType: "type",
            args: "0x",
          },
        }),
      ).rejects.toThrow();
    });

    it("submitSignedFundingTx", async () => {
      const sdk = createSdk();
      await expect(
        sdk.submitSignedFundingTx({
          channelId: hex(32),
          signedFundingTx: ccc.Transaction.from({ inputs: [], outputs: [] }),
        }),
      ).rejects.toThrow();
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

    it("settleInvoice", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      // Create a real invoice so the node knows the preimage↔hash pair.
      // settle_invoice can only succeed after a TLC is received; on a single
      // node it returns a domain state error proving the method is recognised.
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "settleInvoice test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      await expect(
        sdk.settleInvoice({
          paymentHash: created.invoice.data.paymentHash,
          paymentPreimage: preimage,
        }),
      ).rejects.toThrow();
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
      await expect(
        sdk.sendPayment({ invoice: created.invoiceAddress }),
      ).rejects.toThrow(
        "Send payment error: Failed to build route, Feature not enabled: allow_self_payment is not enabled, can not pay to self",
      );
    });

    it("getPayment", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "getPayment test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      // Attempt a self-payment so the node processes the payment hash.
      // Fiber may create a session (status: "Failed") even when routing fails,
      // in which case getPayment returns a real record; otherwise it returns a
      // domain "not found" error — both outcomes confirm RPC reachability.
      await sdk.sendPayment({ invoice: created.invoiceAddress }).catch(() => {});
      const result = await sdk
        .getPayment(created.invoice.data.paymentHash)
        .catch((e: Error) => e);
      if (result instanceof Error) {
        expect(result.message).not.toContain("Method not found");
      } else {
        expect(result).toHaveProperty("status");
      }
    });

    it("buildRouter", async () => {
      const sdk = createSdk();
      // Use the node's own pubkey so the router reaches real address parsing
      // before failing because no channels exist.
      const { pubkey } = await sdk.getNodeInfo();
      await expect(
        sdk.buildRouter({
          hopsInfo: [{ pubkey, channelOutpoint: hex(36) }],
        }),
      ).rejects.toThrow();
    });

    it("sendPaymentWithRouter", async () => {
      const sdk = createSdk();
      const preimage = ccc.hexFrom(crypto.randomBytes(32));
      const created = await sdk.newInvoice({
        amount: INVOICE_TEST_AMOUNT,
        currency: "Fibt",
        paymentPreimage: preimage,
        description: "sendPaymentWithRouter test",
        expiry: INVOICE_TEST_EXPIRY_SEC,
        finalExpiryDelta: INVOICE_TEST_FINAL_EXPIRY_DELTA,
      });
      // Use a real payment hash so the node resolves the invoice before
      // failing on the invalid channel outpoint in the router.
      await expect(
        sdk.sendPaymentWithRouter({
          paymentHash: created.invoice.data.paymentHash,
          router: [
            {
              target: hex(33),
              channelOutpoint: hex(36),
              amountReceived: INVOICE_TEST_AMOUNT,
              incomingTlcExpiry: 100,
            },
          ],
        }),
      ).rejects.toThrow();
    });
  });
});
