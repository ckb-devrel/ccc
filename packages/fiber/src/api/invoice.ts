import { FiberClient } from "../rpc.js";
import type * as fiber from "../types.js";

export class InvoiceApi {
  constructor(private readonly rpc: FiberClient) {}

  async newInvoice(
    params: fiber.NewInvoiceParams,
  ): Promise<fiber.NewInvoiceResult> {
    return this.rpc.callCamel<fiber.NewInvoiceResult>("new_invoice", [params]);
  }

  async parseInvoice(invoice: string): Promise<fiber.CkbInvoice> {
    return this.rpc.callCamel<fiber.CkbInvoice>("parse_invoice", [{ invoice }]);
  }

  async getInvoice(
    paymentHash: fiber.Hash256,
  ): Promise<fiber.GetInvoiceResult> {
    return this.rpc.callCamel<fiber.GetInvoiceResult>("get_invoice", [
      { paymentHash },
    ]);
  }

  async cancelInvoice(
    paymentHash: fiber.Hash256,
  ): Promise<fiber.GetInvoiceResult> {
    return this.rpc.callCamel<fiber.GetInvoiceResult>("cancel_invoice", [
      { paymentHash },
    ]);
  }

  /** Settle an invoice by providing the preimage. */
  async settleInvoice(params: {
    paymentHash: fiber.Hash256;
    paymentPreimage: fiber.Hash256;
  }): Promise<void> {
    await this.rpc.callCamel("settle_invoice", [params]);
  }
}
