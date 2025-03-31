import { FiberClient } from "../core/client";
import { Hash256, PaymentSessionStatus, Pubkey } from "../types";

export class PaymentModule {
  constructor(private client: FiberClient) {}

  /**
   * 发送支付
   */
  async sendPayment(params: {
    target_pubkey?: Pubkey;
    amount?: bigint;
    payment_hash?: Hash256;
    final_tlc_expiry_delta?: bigint;
    tlc_expiry_limit?: bigint;
    invoice?: string;
    timeout?: bigint;
    max_fee_amount?: bigint;
    max_parts?: bigint;
    keysend?: boolean;
    udt_type_script?: any;
    allow_self_payment?: boolean;
    custom_records?: Record<string, string>;
    hop_hints?: any[];
    dry_run?: boolean;
  }): Promise<PaymentSessionStatus> {
    return this.client.call("payment.send_payment", params);
  }

  /**
   * 获取支付状态
   */
  async getPayment(paymentHash: Hash256): Promise<PaymentSessionStatus> {
    return this.client.call("payment.get_payment", {
      payment_hash: paymentHash,
    });
  }
}
