import { ccc } from "@ckb-ccc/core";
import { FiberClient } from "../rpc.js";
import type * as fiber from "../types.js";

export class InvoiceApi {
  constructor(private readonly rpc: FiberClient) {}

  async newInvoice(
    params: fiber.NewInvoiceParams,
  ): Promise<fiber.NewInvoiceResult> {
    return this.rpc.callCamel<fiber.NewInvoiceResult>("new_invoice", [
      {
        ...params,
        paymentHash: params.paymentHash
          ? ccc.hexFrom(params.paymentHash)
          : undefined,
      },
    ]);
  }

  async parseInvoice(
    params: fiber.ParseInvoiceParams,
  ): Promise<fiber.ParseInvoiceResult> {
    return this.rpc.callCamel<fiber.ParseInvoiceResult>("parse_invoice", [
      params,
    ]);
  }

  async getInvoice(
    params: fiber.InvoiceParams,
  ): Promise<fiber.GetInvoiceResult> {
    return this.rpc.callCamel<fiber.GetInvoiceResult>("get_invoice", [params]);
  }

  async cancelInvoice(
    params: fiber.InvoiceParams,
  ): Promise<fiber.GetInvoiceResult> {
    return this.rpc.callCamel<fiber.GetInvoiceResult>("cancel_invoice", [
      params,
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
