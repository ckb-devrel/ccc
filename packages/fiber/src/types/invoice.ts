/**
 * Invoice RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js invoice.d.ts.
 * Params are standalone classes with static from(like) for CCC-style flexible inputs.
 * Hex amount/expiry are normalized to minimal form (no leading zeros) for RPC.
 */
import { ccc } from "@ckb-ccc/core";

/** Minimal hex for RPC (avoids "redundant leading zeros" errors). */
function toMinimalHex(h: ccc.NumLike): ccc.Hex {
  const n = ccc.numFrom(h);
  return `0x${n.toString(16)}`;
}

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

export type InvoiceData = {
  timestamp: ccc.Hex;
  paymentHash: ccc.Hex;
  attrs: Attribute[];
};

export type CkbInvoice = {
  currency: Currency;
  amount?: ccc.Hex;
  signature?: string;
  data: InvoiceData;
};

// ─── NewInvoice ───────────────────────────────────────────────────────────

export type NewInvoiceParamsLike = {
  amount: ccc.NumLike;
  description?: string;
  currency: Currency;
  paymentPreimage: ccc.HexLike;
  expiry?: ccc.NumLike;
  fallbackAddress?: string;
  finalExpiryDelta?: ccc.NumLike;
  udtTypeScript?: ccc.ScriptLike;
  hashAlgorithm?: HashAlgorithm;
  paymentHash?: ccc.HexLike;
  allowMpp?: boolean;
};

export class NewInvoiceParams {
  constructor(
    public readonly amount: ccc.Hex,
    public readonly currency: Currency,
    public readonly paymentPreimage: ccc.Hex,
    public readonly description?: string,
    public readonly expiry?: ccc.Hex,
    public readonly fallbackAddress?: string,
    public readonly finalExpiryDelta?: ccc.Hex,
    public readonly udtTypeScript?: ccc.Script,
    public readonly hashAlgorithm?: HashAlgorithm,
    public readonly paymentHash?: ccc.HexLike,
    public readonly allowMpp?: boolean,
  ) {}

  static from(like: NewInvoiceParamsLike): NewInvoiceParams {
    return new NewInvoiceParams(
      toMinimalHex(like.amount),
      like.currency,
      ccc.hexFrom(like.paymentPreimage),
      like.description,
      like.expiry != null ? toMinimalHex(like.expiry) : undefined,
      like.fallbackAddress,
      like.finalExpiryDelta != null
        ? toMinimalHex(like.finalExpiryDelta)
        : undefined,
      like.udtTypeScript != null
        ? ccc.Script.from(like.udtTypeScript)
        : undefined,
      like.hashAlgorithm,
      like.paymentHash,
      like.allowMpp,
    );
  }
}

export type InvoiceResult = {
  invoiceAddress: string;
  invoice: CkbInvoice;
};

export type NewInvoiceResult = InvoiceResult;

// ─── ParseInvoice ──────────────────────────────────────────────────────────

export type ParseInvoiceParamsLike = {
  invoice: string;
};

export class ParseInvoiceParams {
  constructor(public readonly invoice: string) {}

  static from(like: ParseInvoiceParamsLike): ParseInvoiceParams {
    return new ParseInvoiceParams(like.invoice);
  }
}

export type ParseInvoiceResult = {
  invoice: CkbInvoice;
};

// ─── InvoiceParams (get_invoice / cancel_invoice) ───────────────────────────

export type InvoiceParamsLike = {
  paymentHash: ccc.HexLike;
};

export class InvoiceParams {
  constructor(public readonly paymentHash: ccc.Hex) {}

  static from(like: InvoiceParamsLike): InvoiceParams {
    return new InvoiceParams(ccc.hexFrom(like.paymentHash));
  }
}

export type GetInvoiceResult = {
  invoiceAddress: string;
  invoice: CkbInvoice;
  status: CkbInvoiceStatus;
};
