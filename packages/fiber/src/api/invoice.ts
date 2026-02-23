import { ccc } from "@ckb-ccc/core";
import { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";

export class InvoiceApi {
  constructor(private readonly rpc: FiberClient) {}

  async newInvoice(
    params: fiber.NewInvoiceParamsLike,
  ): Promise<fiber.NewInvoiceResult> {
    const normalized = fiber.NewInvoiceParams.from(params);
    return this.rpc.callCamel<fiber.NewInvoiceResult>("new_invoice", [
      { ...normalized },
    ]);
  }

  async parseInvoice(
    params: fiber.ParseInvoiceParamsLike,
  ): Promise<fiber.ParseInvoiceResult> {
    const normalized = fiber.ParseInvoiceParams.from(params);
    return this.rpc.callCamel<fiber.ParseInvoiceResult>("parse_invoice", [
      { ...normalized },
    ]);
  }

  async getInvoice(
    params: fiber.InvoiceParamsLike,
  ): Promise<fiber.GetInvoiceResult> {
    const normalized = fiber.InvoiceParams.from(params);
    return this.rpc.callCamel<fiber.GetInvoiceResult>("get_invoice", [
      { ...normalized },
    ]);
  }

  async cancelInvoice(
    params: fiber.InvoiceParamsLike,
  ): Promise<fiber.GetInvoiceResult> {
    const normalized = fiber.InvoiceParams.from(params);
    return this.rpc.callCamel<fiber.GetInvoiceResult>("cancel_invoice", [
      { ...normalized },
    ]);
  }

  /** Settle an invoice by providing the preimage. */
  async settleInvoice(params: {
    paymentHash: ccc.HexLike;
    paymentPreimage: ccc.HexLike;
  }): Promise<void> {
    await this.rpc.callCamel("settle_invoice", [
      {
        paymentHash: ccc.hexFrom(params.paymentHash),
        paymentPreimage: ccc.hexFrom(params.paymentPreimage),
      },
    ]);
  }
}
