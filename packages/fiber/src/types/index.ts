/**
 * Fiber SDK types (camelCase). Enumerated from @nervosnetwork/fiber-js
 * channel, invoice, and payment RPC parameters (no template; explicit keys).
 */
export type Pubkey = string;
/** Secp256k1 secret key (RPC type Privkey). */
export type Privkey = string;

export type PaymentStatus = import("./payment.js").PaymentSessionStatus;

export * from "./channel.js";
export * from "./invoice.js";
export * from "./payment.js";
