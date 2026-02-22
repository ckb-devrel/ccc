import { FiberClient } from "../rpc/client.js";
import type {
  BuildRouterResult,
  Hash256,
  HopRequire,
  PaymentResult,
  Script,
  SendPaymentParams,
  SendPaymentWithRouterParams,
} from "../types.js";

export class PaymentApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendPayment(params: SendPaymentParams): Promise<PaymentResult> {
    return this.rpc.callCamel<PaymentResult>("send_payment", [params]);
  }

  async getPayment(paymentHash: Hash256): Promise<PaymentResult> {
    return this.rpc.callCamel<PaymentResult>("get_payment", [{ paymentHash }]);
  }

  async buildRouter(params: {
    amount?: string | number;
    udtTypeScript?: Script;
    hopsInfo: HopRequire[];
    finalTlcExpiryDelta?: string | number;
  }): Promise<BuildRouterResult> {
    return this.rpc.callCamel<BuildRouterResult>("build_router", [params]);
  }

  async sendPaymentWithRouter(
    params: SendPaymentWithRouterParams,
  ): Promise<PaymentResult> {
    return this.rpc.callCamel<PaymentResult>("send_payment_with_router", [
      params,
    ]);
  }
}
