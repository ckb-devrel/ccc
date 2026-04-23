import { ccc } from "@ckb-ccc/core";
import type { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";
import type { Constructor } from "../utils.js";

function toInvoiceParams(
  params: fiber.InvoiceParamsLike | ccc.HexLike,
): fiber.InvoiceParamsLike {
  return typeof params === "object" &&
    params !== null &&
    "paymentHash" in params
    ? params
    : { paymentHash: params as ccc.HexLike };
}

export function InvoiceMixin<
  TBase extends Constructor<{ readonly rpc: FiberClient }>,
>(Base: TBase) {
  return class InvoiceMixin extends Base {
    declare readonly rpc: FiberClient;

    async newInvoice(
      params: fiber.NewInvoiceParamsLike,
    ): Promise<fiber.NewInvoiceResult> {
      const normalized = fiber.NewInvoiceParams.from(params);
      return this.rpc.call<fiber.NewInvoiceResult>("new_invoice", [
        { ...normalized },
      ]);
    }

    async parseInvoice(
      params: fiber.ParseInvoiceParamsLike,
    ): Promise<fiber.CkbInvoice> {
      const normalized = fiber.ParseInvoiceParams.from(params);
      const result = await this.rpc.call<fiber.ParseInvoiceResult>(
        "parse_invoice",
        [{ ...normalized }],
      );
      return result.invoice;
    }

    async getInvoice(
      params: fiber.InvoiceParamsLike | ccc.HexLike,
    ): Promise<fiber.GetInvoiceResult> {
      const normalized = fiber.InvoiceParams.from(toInvoiceParams(params));
      return this.rpc.call<fiber.GetInvoiceResult>("get_invoice", [
        { ...normalized },
      ]);
    }

    async cancelInvoice(
      params: fiber.InvoiceParamsLike | ccc.HexLike,
    ): Promise<fiber.GetInvoiceResult> {
      const normalized = fiber.InvoiceParams.from(toInvoiceParams(params));
      return this.rpc.call<fiber.GetInvoiceResult>("cancel_invoice", [
        { ...normalized },
      ]);
    }

    async settleInvoice(params: fiber.SettleInvoiceParamsLike): Promise<void> {
      const normalized = fiber.SettleInvoiceParams.from(params);
      await this.rpc.call("settle_invoice", [{ ...normalized }]);
    }
  };
}

class FiberClientBase {
  constructor(public readonly rpc: FiberClient) {}
}

export class InvoiceApi extends InvoiceMixin(FiberClientBase) {}
