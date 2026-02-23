/**
 * Invoice RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js invoice.d.ts.
 */
import type { ccc } from "@ckb-ccc/core";
import type { Script } from "./channel.js";

export type Currency = "Fibb" | "Fibt" | "Fibd";

export type CkbInvoiceStatus =
  | "Open"
  | "Cancelled"
  | "Expired"
  | "Received"
  | "Paid";

export type HashAlgorithm = "ckb_hash" | "sha256";

export type Attribute =
  | { FinalHtlcMinimumExpiryDelta: ccc.Hex }
  | { ExpiryTime: ccc.Hex }
  | { Description: string }
  | { FallbackAddr: string }
  | { UdtScript: ccc.Hex }
  | { PayeePublicKey: string }
  | { HashAlgorithm: number }
  | { Feature: ccc.Hex };

export interface InvoiceData {
  timestamp: ccc.Hex;
  paymentHash: ccc.Hex;
  attrs: Attribute[];
}

export interface CkbInvoice {
  currency: Currency;
  amount?: ccc.Hex;
  signature?: string;
  data: InvoiceData;
}

export interface NewInvoiceParams {
  amount: ccc.Hex;
  description?: string;
  currency: Currency;
  paymentPreimage: ccc.Hex;
  expiry?: ccc.Hex;
  fallbackAddress?: string;
  finalExpiryDelta?: ccc.Hex;
  udtTypeScript?: Script;
  hashAlgorithm?: HashAlgorithm;
  /** Payment hash for hold invoice (preimage must be absent). */
  paymentHash?: ccc.HexLike;
  /** Whether to allow multi-part payment. */
  allowMpp?: boolean;
}

export interface InvoiceResult {
  invoiceAddress: string;
  invoice: CkbInvoice;
}

export interface ParseInvoiceParams {
  invoice: string;
}

export interface ParseInvoiceResult {
  invoice: CkbInvoice;
}

export interface InvoiceParams {
  paymentHash: ccc.Hex;
}

export interface GetInvoiceResult {
  invoiceAddress: string;
  invoice: CkbInvoice;
  status: CkbInvoiceStatus;
}

export type NewInvoiceResult = InvoiceResult;
