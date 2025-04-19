import { FiberClient } from "../client.js";
import { CkbInvoice, CkbInvoiceStatus } from "../types.js";

export class InvoiceModule {
  constructor(private client: FiberClient) {}

  /**
   * Create a new invoice
   */
  async newInvoice(params: {
    amount: bigint;
    description?: string;
    expiry?: bigint;
    payment_secret?: string;
  }): Promise<CkbInvoice> {
    return this.client.call("new_invoice", [params]);
  }

  /**
   * Parse an invoice
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.client.call("parse_invoice", [{ invoice }]);
  }

  /**
   * Get invoice details
   */
  async getInvoice(payment_hash: string): Promise<{
    status: CkbInvoiceStatus;
    invoice_address: string;
    invoice: CkbInvoice;
  }> {
    return this.client.call("get_invoice", [{ payment_hash }]);
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(payment_hash: string): Promise<void> {
    return this.client.call("cancel_invoice", [{ payment_hash }]);
  }
}
