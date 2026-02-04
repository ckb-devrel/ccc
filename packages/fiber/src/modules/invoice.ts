import { FiberClient } from "../client.js";
import {
  CkbInvoice,
  CkbInvoiceStatus,
  Currency,
  Hash256,
  HashAlgorithm,
  Script,
} from "../types.js";

export interface NewInvoiceParams {
  amount: string | number;
  description?: string;
  currency: Currency;
  payment_preimage: Hash256;
  expiry?: string | number;
  fallback_address?: string;
  final_expiry_delta?: string | number;
  udt_type_script?: Script;
  hash_algorithm?: HashAlgorithm;
}

export interface NewInvoiceResult {
  invoice_address: string;
  invoice: CkbInvoice;
}

export class InvoiceModule {
  constructor(private client: FiberClient) {}

  /**
   * Generate a new invoice.
   */
  async newInvoice(params: NewInvoiceParams): Promise<NewInvoiceResult> {
    return this.client.call<NewInvoiceResult>("new_invoice", [params]);
  }

  /**
   * Parse an encoded invoice string.
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.client.call<CkbInvoice>("parse_invoice", [{ invoice }]);
  }

  /**
   * Get invoice by payment hash.
   */
  async getInvoice(payment_hash: Hash256): Promise<{
    invoice_address: string;
    invoice: CkbInvoice;
    status: CkbInvoiceStatus;
  }> {
    return this.client.call("get_invoice", [{ payment_hash }]);
  }

  /**
   * Cancel an invoice (only when status is Open).
   */
  async cancelInvoice(payment_hash: Hash256): Promise<{
    invoice_address: string;
    invoice: CkbInvoice;
    status: CkbInvoiceStatus;
  }> {
    return this.client.call("cancel_invoice", [{ payment_hash }]);
  }
}
