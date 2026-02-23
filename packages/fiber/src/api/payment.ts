import { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";

export class PaymentApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendPayment(
    params: fiber.SendPaymentParamsLike,
  ): Promise<fiber.PaymentResult> {
    const normalized = fiber.SendPaymentCommandParams.from(params);
    return this.rpc.callCamel<fiber.PaymentResult>("send_payment", [
      { ...normalized },
    ]);
  }

  async getPayment(
    params: fiber.GetPaymentParamsLike,
  ): Promise<fiber.PaymentResult> {
    const normalized = fiber.GetPaymentCommandParams.from(params);
    return this.rpc.callCamel<fiber.PaymentResult>("get_payment", [
      { ...normalized },
    ]);
  }

  async buildRouter(
    params: fiber.BuildRouterParamsLike,
  ): Promise<fiber.BuildRouterResult> {
    const normalized = fiber.BuildRouterParams.from(params);
    return this.rpc.callCamel<fiber.BuildRouterResult>("build_router", [
      { ...normalized },
    ]);
  }

  async sendPaymentWithRouter(
    params: fiber.SendPaymentWithRouterParamsLike,
  ): Promise<fiber.PaymentResult> {
    const normalized = fiber.SendPaymentWithRouterParams.from(params);
    return this.rpc.callCamel<fiber.PaymentResult>("send_payment_with_router", [
      { ...normalized },
    ]);
  }
}
