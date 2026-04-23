import { ccc } from "@ckb-ccc/core";
import { toHex } from "../utils.js";

export type Currency = "Fibb" | "Fibt" | "Fibd";

export type CkbInvoiceStatus =
  | "Open"
  | "Cancelled"
  | "Expired"
  | "Received"
  | "Paid";

export type HashAlgorithm = "ckb_hash" | "sha256";

export type Attribute =
  | { finalHtlcMinimumExpiryDelta: ccc.Hex }
  | { expiryTime: ccc.Hex }
  | { description: string }
  | { fallbackAddr: string }
  | { udtScript: ccc.Hex }
  | { payeePublicKey: string }
  | { hashAlgorithm: number }
  | { feature: ccc.Hex };

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
    public readonly paymentHash?: ccc.Hex,
    public readonly allowMpp?: boolean,
  ) {}

  static from(like: NewInvoiceParamsLike): NewInvoiceParams {
    return new NewInvoiceParams(
      ccc.numToHex(like.amount),
      like.currency,
      ccc.hexFrom(like.paymentPreimage),
      like.description,
      toHex(like.expiry),
      like.fallbackAddress,
      toHex(like.finalExpiryDelta),
      like.udtTypeScript ? ccc.Script.from(like.udtTypeScript) : undefined,
      like.hashAlgorithm,
      like.paymentHash ? ccc.hexFrom(like.paymentHash) : undefined,
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

// ─── SettleInvoice ─────────────────────────────────────────────────────────

export type SettleInvoiceParamsLike = {
  paymentHash: ccc.HexLike;
  paymentPreimage: ccc.HexLike;
};

export class SettleInvoiceParams {
  constructor(
    public readonly paymentHash: ccc.Hex,
    public readonly paymentPreimage: ccc.Hex,
  ) {}

  static from(like: SettleInvoiceParamsLike): SettleInvoiceParams {
    return new SettleInvoiceParams(
      ccc.hexFrom(like.paymentHash),
      ccc.hexFrom(like.paymentPreimage),
    );
  }
}

export type GetInvoiceResult = {
  invoiceAddress: string;
  invoice: CkbInvoice;
  status: CkbInvoiceStatus;
};
