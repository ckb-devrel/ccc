import { FiberClient } from "../rpc.js";
import type * as fiber from "../types.js";

export class PaymentApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendPayment(
    params: fiber.SendPaymentParams,
  ): Promise<fiber.PaymentResult> {
    return this.rpc.callCamel<fiber.PaymentResult>("send_payment", [params]);
  }

  async getPayment(
    params: fiber.GetPaymentParams,
  ): Promise<fiber.PaymentResult> {
    return this.rpc.callCamel<fiber.PaymentResult>("get_payment", [params]);
  }

  async buildRouter(
    params: fiber.BuildRouterParams,
  ): Promise<fiber.BuildRouterResult> {
    return this.rpc.callCamel<fiber.BuildRouterResult>("build_router", [
      params,
    ]);
  }

  async sendPaymentWithRouter(
    params: fiber.SendPaymentWithRouterParams,
  ): Promise<fiber.PaymentResult> {
    return this.rpc.callCamel<fiber.PaymentResult>("send_payment_with_router", [
      params,
    ]);
  }
}
