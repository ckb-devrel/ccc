import { FiberClient } from "../client";
import {
  Hash256,
  PaymentCustomRecords,
  PaymentSessionStatus,
  SessionRoute,
} from "../types";

export class PaymentModule {
  constructor(private client: FiberClient) {}

  /**
   * 发送支付
   */
  async sendPayment(params: {
    payment_hash: string;
    amount: bigint;
    fee_rate: bigint;
    custom_records?: PaymentCustomRecords;
    route?: SessionRoute;
  }): Promise<void> {
    return this.client.call("send_payment", [params]);
  }

  /**
   * 获取支付
   */
  async getPayment(payment_hash: string): Promise<{
    status: PaymentSessionStatus;
    payment_hash: Hash256;
    created_at: bigint;
    last_updated_at: bigint;
    failed_error?: string;
    fee: bigint;
    custom_records?: PaymentCustomRecords;
    route: SessionRoute;
  }> {
    return this.client.call("get_payment", [payment_hash]);
  }
}
