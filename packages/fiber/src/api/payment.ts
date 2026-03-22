import { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";

export class PaymentApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendPayment(
    params: fiber.SendPaymentCommandParamsLike,
  ): Promise<fiber.PaymentResult> {
    const normalized = fiber.SendPaymentCommandParams.from(params);
    return this.rpc.call<fiber.PaymentResult>("send_payment", [
      { ...normalized },
    ]);
  }

  async getPayment(
    params: fiber.GetPaymentCommandParamsLike,
  ): Promise<fiber.PaymentResult> {
    const normalized = fiber.GetPaymentCommandParams.from(params);
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
}
