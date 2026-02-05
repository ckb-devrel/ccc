import { FiberClient } from "../rpc/client.js";
import type {
  CkbInvoice,
  CkbInvoiceStatus,
  Currency,
  Hash256,
  HashAlgorithm,
  Script,
} from "../types.js";

/** RPC response for get_invoice and cancel_invoice. */
export interface GetInvoiceResult {
  invoiceAddress: string;
  invoice: CkbInvoice;
  status: CkbInvoiceStatus;
}

export interface NewInvoiceParams {
  amount: string | number;
  description?: string;
  currency: Currency;
  paymentPreimage: Hash256;
  expiry?: string | number;
  fallbackAddress?: string;
  finalExpiryDelta?: string | number;
  udtTypeScript?: Script;
  hashAlgorithm?: HashAlgorithm;
}

export interface NewInvoiceResult {
  invoiceAddress: string;
  invoice: CkbInvoice;
}

export class InvoiceApi {
  constructor(private readonly rpc: FiberClient) {}

  async newInvoice(params: NewInvoiceParams): Promise<NewInvoiceResult> {
    return this.rpc.callCamel<NewInvoiceResult>("new_invoice", [params]);
  }

  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.rpc.callCamel<CkbInvoice>("parse_invoice", [{ invoice }]);
  }

  async getInvoice(paymentHash: Hash256): Promise<GetInvoiceResult> {
    return this.rpc.callCamel<GetInvoiceResult>("get_invoice", [
      { paymentHash },
    ]);
  }

  async cancelInvoice(paymentHash: Hash256): Promise<GetInvoiceResult> {
    return this.rpc.callCamel<GetInvoiceResult>("cancel_invoice", [
      { paymentHash },
    ]);
  }
}
