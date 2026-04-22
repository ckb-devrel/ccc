# Fiber SDK

A TypeScript/JavaScript SDK for building on [Fiber](https://github.com/nervosnetwork/fiber)—the Nervos payment channel network. One client, one config, and typed methods for channels, invoices, payments, node info, and peers. Built for the [CCC](https://github.com/ckb-devrel/ccc) stack with camelCase APIs and full type exports.

---

## Why use it

- **Single entry point** — `FiberSDK` wraps Fiber JSON-RPC so you don’t deal with raw RPC or snake_case.
- **TypeScript-first** — Params and results are typed; import `Channel`, `PaymentResult`, `NewInvoiceParamsLike`, etc. from the package.
- **Minimal surface** — Channels, invoices, payments, plus node info and peer management.
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
  amount: "0x5f5e100", // 100000000 decimal
  currency: "Fibt",
  paymentPreimage: "0x" + "01".repeat(32), // 32 bytes; each byte is 0x01 = 1 decimal (example preimage)
  description: "Coffee",
  expiry: "0xe10", // 3600 decimal
  finalExpiryDelta: "0x9283C0", // 9601984 decimal
});
const payment = await sdk.sendPayment({ invoice: invoiceAddress });
```

That’s the core loop: create an invoice (always pass `paymentPreimage`; optional `paymentHash` is available on `NewInvoiceParamsLike` for hold-style setups), share `invoiceAddress`, and the payer calls `sendPayment` with it.

---

## SDK at a glance

| Domain      | What it does                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| **Channel** | List channels, open and accept, shut down or abandon, update channel options (`sdk.channel.updateChannel`). |
| **Invoice** | Create, parse, get or cancel by payment hash, settle with preimage (`sdk.invoice.settleInvoice`).           |
| **Payment** | Send a payment, get status by hash, build a router, send with a pre-built router.                           |
| **Info**    | Node metadata via `getNodeInfo()` (`node_info` RPC).                                                        |
| **Peer**    | `connectPeer`, `disconnectPeer`, `listPeers`.                                                               |

Most calls exist both as **top-level methods** on `FiberSDK` and on **domain objects** `sdk.channel`, `sdk.invoice`, `sdk.payment`, `sdk.info`, and `sdk.peer`. Use the domain objects when a method is only there (e.g. `acceptChannel`, `buildRouter`, `settleInvoice`, `updateChannel`). Types are exported so you can annotate your code with `Channel`, `PaymentResult`, `NewInvoiceParamsLike`, `SettleInvoiceParamsLike`, and so on.

---

## Node info and peers

**Node**

```ts
const info = await sdk.getNodeInfo();
// info.version, info.nodeId, info.addresses, ...
```

**Peers**

```ts
await sdk.connectPeer({ address: "/ip4/127.0.0.1/tcp/8228", save: true });
const peers = await sdk.listPeers();
await sdk.disconnectPeer({ peerId: "<peer id>" });
```

---

## Channels

Channels are the links between your node and others. You list them, open new ones toward a peer, and either shut them down cleanly (when they’re open) or abandon them (e.g. when an open never completed).

**List and open**

```ts
const channels = await sdk.listChannels();
// Optional filter: sdk.listChannels({ includeClosed: false })

const temporaryChannelId = await sdk.openChannel({
  peerId: "<peer multiaddr or id>",
  fundingAmount: "0xba43b7400", // 50000000000 decimal
  public: true,
});
```

The counterparty accepts with `sdk.channel.acceptChannel({ temporaryChannelId, fundingAmount, ... })` and gets back the final `channelId`. You use that `channelId` later to shut down or update the channel.

**Shut down, abandon, or update**

```ts
await sdk.shutdownChannel({
  channelId: readyChannelId,
  feeRate: "0x3FC", // 1020 decimal
  force: false,
});

await sdk.abandonChannel({ channelId: temporaryChannelId });

await sdk.channel.updateChannel({
  channelId: readyChannelId,
  enabled: true,
});
```

Use `shutdownChannel` for an established channel you want to close; use `abandonChannel` for a channel that never reached “ready” (e.g. a stuck open). `updateChannel` is only on `sdk.channel` (not duplicated as a top-level `FiberSDK` method).

---

## Invoices

Invoices represent a request to be paid: amount, currency, **payment preimage** (or optional `paymentHash` for hold invoices), optional description and expiry. You create one, share the **invoice address**, and the payer pays to that address.

**Create and share**

```ts
const { invoiceAddress, invoice } = await sdk.newInvoice({
  amount: "0x5f5e100", // 100000000 decimal
  currency: "Fibt",
  paymentPreimage: "0x" + "01".repeat(32), // 32 bytes; each byte is 0x01 = 1 decimal (example preimage)
  description: "Order #42",
  expiry: "0xe10", // 3600 decimal
  finalExpiryDelta: "0x9283C0", // 9601984 decimal
});
// Send invoiceAddress to the payer (e.g. QR or link).
// Keep invoice.data.paymentHash to look up or cancel later.
```

See `NewInvoiceParamsLike` in `src/types/invoice.ts` for optional `paymentHash`, `allowMpp`, UDT script, and other fields.

**Parse, get, cancel**

```ts
const parsed = await sdk.parseInvoice({ invoice: invoiceAddress });
const info = await sdk.getInvoice(invoice.data.paymentHash);
await sdk.cancelInvoice(invoice.data.paymentHash);
```

`parseInvoice` on `FiberSDK` takes `{ invoice: string }` and returns a `CkbInvoice` (the API layer returns `{ invoice }` as `ParseInvoiceResult`).

Settling an invoice with a preimage is done via `sdk.invoice.settleInvoice({ paymentHash, paymentPreimage })` (typed as `SettleInvoiceParamsLike`).

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

If you prefer to build the route yourself, use `sdk.payment.buildRouter(...)` and `sdk.payment.sendPaymentWithRouter(...)`. Params and results are typed (`SendPaymentCommandParamsLike`, `PaymentResult`, etc.).

---

## Basic usage flows

**Flow 1: Receive payment**  
Create an invoice with `newInvoice` (include `paymentPreimage` or `paymentHash` per your flow), expose `invoiceAddress` to the payer. They call `sendPayment({ invoice: invoiceAddress })`. You can poll or use `getInvoice(paymentHash)` / `getPayment(paymentHash)` as needed.

**Flow 2: Send payment**  
Obtain an invoice string (e.g. from the receiver). Optionally `parseInvoice({ invoice })` to inspect it. Call `sendPayment({ invoice })`. Use `getPayment(paymentHash)` to check status and fee.

**Flow 3: Channel lifecycle**  
Open with `openChannel`; the other side calls `acceptChannel`. Once ready, use `listChannels` to see state and balances. To close, use `shutdownChannel`; if the channel never became ready, use `abandonChannel`. Adjust live settings with `sdk.channel.updateChannel` when supported.

---

## TypeScript and exports

- All APIs use **camelCase** (e.g. `paymentHash`, `invoiceAddress`). `FiberClient` converts params with `camelToSnake` and responses with `snakeToCamel` (see `utils.ts`). Bigint and number values in RPC params are serialized to hex strings.
- Import **types** from the package: `Channel`, `PaymentResult`, `NewInvoiceParamsLike`, `FiberClient`, etc.
- Besides `FiberSDK`, the package exports `ChannelApi`, `InvoiceApi`, `PaymentApi`, `InfoApi`, `PeerApi`, and `FiberClient` for custom wiring, plus helpers from `utils.ts` (`camelToSnake`, `snakeToCamel`, `toHex`).

For full type definitions and optional parameters, use your editor’s IntelliSense or browse `packages/fiber/src/types/`.

---

## Learn more

- [Fiber](https://github.com/nervosnetwork/fiber) — Node implementation and RPC.
- [CCC](https://github.com/ckb-devrel/ccc) — CKBer’s Codebase / Common Chains Connector.
