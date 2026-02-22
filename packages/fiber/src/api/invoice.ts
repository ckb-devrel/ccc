import { FiberClient } from "../rpc/client.js";
import type {
  CkbInvoice,
  GetInvoiceResult,
  Hash256,
  NewInvoiceParams,
  NewInvoiceResult,
} from "../types.js";

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

  /** Settle an invoice by providing the preimage. */
  async settleInvoice(params: {
    paymentHash: Hash256;
    paymentPreimage: Hash256;
  }): Promise<void> {
    await this.rpc.callCamel("settle_invoice", [params]);
  }
}
