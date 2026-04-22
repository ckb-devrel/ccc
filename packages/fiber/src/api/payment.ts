import { ccc } from "@ckb-ccc/core";
import type { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";
import type { Constructor } from "../utils.js";

function toGetPaymentParams(
  params: fiber.GetPaymentCommandParamsLike | ccc.HexLike,
): fiber.GetPaymentCommandParamsLike {
  return typeof params === "object" && "paymentHash" in params
    ? params
    : { paymentHash: params as ccc.HexLike };
}

export function PaymentMixin<
  TBase extends Constructor<{ readonly rpc: FiberClient }>,
>(Base: TBase) {
  return class PaymentMixin extends Base {
    declare readonly rpc: FiberClient;

    async sendPayment(
      params: fiber.SendPaymentCommandParamsLike,
    ): Promise<fiber.PaymentResult> {
      const normalized = fiber.SendPaymentCommandParams.from(params);
      return this.rpc.call<fiber.PaymentResult>("send_payment", [
        { ...normalized },
      ]);
    }

    async getPayment(
      params: fiber.GetPaymentCommandParamsLike | ccc.HexLike,
    ): Promise<fiber.PaymentResult> {
      const normalized = fiber.GetPaymentCommandParams.from(
        toGetPaymentParams(params),
      );
      return this.rpc.call<fiber.PaymentResult>("get_payment", [
        { ...normalized },
      ]);
    }

    async buildRouter(
      params: fiber.BuildRouterParamsLike,
    ): Promise<fiber.BuildPaymentRouterResult> {
      const normalized = fiber.BuildRouterParams.from(params);
      return this.rpc.call<fiber.BuildPaymentRouterResult>("build_router", [
        { ...normalized },
      ]);
    }

    async sendPaymentWithRouter(
      params: fiber.SendPaymentWithRouterParamsLike,
    ): Promise<fiber.PaymentResult> {
      const normalized = fiber.SendPaymentWithRouterParams.from(params);
      return this.rpc.call<fiber.PaymentResult>("send_payment_with_router", [
        { ...normalized },
      ]);
    }
  };
}

class FiberClientBase {
  constructor(public readonly rpc: FiberClient) {}
}

export class PaymentApi extends PaymentMixin(FiberClientBase) {}
