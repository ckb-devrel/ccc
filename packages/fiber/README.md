# Fiber SDK

A TypeScript/JavaScript SDK for building on [Fiber](https://github.com/nervosnetwork/fiber)—the Nervos payment channel network. One client, one config, and a small set of methods for channels, invoices, and payments. Built for the [CCC](https://github.com/ckb-devrel/ccc) stack with camelCase APIs and full type exports.

---

## Why use it

- **Single entry point** — `FiberSDK` wraps channel, invoice, and payment RPC so you don’t deal with raw RPC or snake_case.
- **TypeScript-first** — All params and results are typed; import `Channel`, `PaymentResult`, `NewInvoiceParams`, etc. from the package.
- **Minimal surface** — Focused on the operations you need: open/close channels, create and resolve invoices, send and track payments.
- **Fiber-native** — Talks to a running Fiber node over HTTP; no extra runtimes. Use it in Node or the browser.

---

## Install

```bash
npm install @ckb-ccc/fiber
```

---

## Quick start

Create a client and point it at your Fiber node:

```ts
import { FiberSDK } from "@ckb-ccc/fiber";

const sdk = new FiberSDK({
  endpoint: "http://127.0.0.1:8227",
  timeout: 5000, // optional, milliseconds
});
```

Then use the same `sdk` for channels, invoices, and payments:

```ts
const channels = await sdk.listChannels();
const { invoiceAddress, invoice } = await sdk.newInvoice({
  amount: "0x5f5e100",
  currency: "Fibt",
  description: "Coffee",
  expiry: "0xe10",
  finalExpiryDelta: "0x9283C0",
});
const payment = await sdk.sendPayment({ invoice: invoiceAddress });
```

That’s the core loop: create an invoice, share `invoiceAddress`, and the payer calls `sendPayment` with it.

---

## SDK at a glance

| Domain      | What it does                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Channel** | List channels, open new ones (with a peer), accept incoming opens, shut down or abandon channels.                                       |
| **Invoice** | Create invoices (with amount, currency, optional preimage), parse invoice strings, get or cancel by payment hash, settle with preimage. |
| **Payment** | Send a payment from an invoice address, or with a pre-built router; get payment status by hash.                                         |

All of this is available either as **top-level methods** on `FiberSDK` or as **domain objects** `sdk.channel`, `sdk.invoice`, and `sdk.payment` when you need extra methods (e.g. `acceptChannel`, `buildRouter`, `settleInvoice`). Types are exported so you can type your own functions with `Channel`, `PaymentResult`, `NewInvoiceParams`, and so on.

---

## Channels

Channels are the links between your node and others. You list them, open new ones toward a peer, and either shut them down cleanly (when they’re open) or abandon them (e.g. when an open never completed).

**List and open**

```ts
const channels = await sdk.listChannels();
// Optional filter: sdk.listChannels({ includeClosed: false })

const temporaryChannelId = await sdk.openChannel({
  peerId: "<peer multiaddr or id>",
  fundingAmount: "0xba43b7400",
  public: true,
});
```

The counterparty accepts with `sdk.channel.acceptChannel({ temporaryChannelId, fundingAmount, ... })` and gets back the final `channelId`. You use that `channelId` later to shut down or update the channel.

**Shut down or abandon**

```ts
await sdk.shutdownChannel({
  channelId: readyChannelId,
  feeRate: "0x3FC",
  force: false,
});

await sdk.abandonChannel({ channelId: temporaryChannelId });
```

Use `shutdownChannel` for an established channel you want to close; use `abandonChannel` for a channel that never reached “ready” (e.g. a stuck open).

---

## Invoices

Invoices represent a request to be paid: amount, currency, optional description and expiry. You create one, share the **invoice address**, and the payer pays to that address.

**Create and share**

```ts
const { invoiceAddress, invoice } = await sdk.newInvoice({
  amount: "0x5f5e100",
  currency: "Fibt",
  description: "Order #42",
  expiry: "0xe10",
  finalExpiryDelta: "0x9283C0",
});
// Send invoiceAddress to the payer (e.g. QR or link).
// Keep invoice.data.paymentHash to look up or cancel later.
```

For keysend-style flows you can pass `paymentPreimage`; for hold invoices, pass `paymentHash` instead. Full options are in the `NewInvoiceParams` type.

**Parse, get, cancel**

```ts
const parsed = await sdk.parseInvoice(invoiceAddress);
const info = await sdk.getInvoice(invoice.data.paymentHash);
await sdk.cancelInvoice(invoice.data.paymentHash);
```

Settling an invoice with a preimage (e.g. after receiving a payment) is done via `sdk.invoice.settleInvoice({ paymentHash, paymentPreimage })`.

---

## Payments

Payments are “send money to this invoice.” You pass the invoice address (or a pre-built router via `sdk.payment`), and the node figures out routing and state updates.

**Send and track**

```ts
const result = await sdk.sendPayment({
  invoice: invoiceAddress,
});
// result.paymentHash, result.status, result.fee, ...

const status = await sdk.getPayment(result.paymentHash);
```

If you prefer to build the route yourself, use `sdk.payment.buildRouter(...)` and `sdk.payment.sendPaymentWithRouter(...)`. All payment results and params are typed (`PaymentResult`, `SendPaymentParams`, etc.).

---

## Basic usage flows

**Flow 1: Receive payment**  
Create an invoice with `newInvoice`, expose `invoiceAddress` to the payer. They call `sendPayment({ invoice: invoiceAddress })`. You can poll or use `getInvoice(paymentHash)` / `getPayment(paymentHash)` as needed.

**Flow 2: Send payment**  
Obtain an invoice string (e.g. from the receiver). Optionally `parseInvoice` to inspect it. Call `sendPayment({ invoice })`. Use `getPayment(paymentHash)` to check status and fee.

**Flow 3: Channel lifecycle**  
Open with `openChannel`; the other side calls `acceptChannel`. Once ready, use `listChannels` to see state and balances. To close, use `shutdownChannel`; if the channel never became ready, use `abandonChannel`.

---

## TypeScript and exports

- All APIs use **camelCase** (e.g. `paymentHash`, `invoiceAddress`). The SDK converts to/from the Fiber RPC’s snake_case.
- You can import **types** from the package and use them as `fiber.Channel`, `fiber.PaymentResult`, `fiber.NewInvoiceParams`, etc., or as standalone types depending on how you import.
- Besides `FiberSDK`, the package exports `ChannelApi`, `InvoiceApi`, `PaymentApi`, and `FiberClient` for custom wiring, plus key-conversion helpers from `keys.js`.

For full type definitions and optional parameters, use your editor’s IntelliSense or open `src/types.ts` in the repo.

---

## Learn more

- [Fiber](https://github.com/nervosnetwork/fiber) — Node implementation and RPC.
- [CCC](https://github.com/ckb-devrel/ccc) — CKBer’s Codebase / Common Chains Connector.
