import { FiberClient } from "../client";
import { Currency, Script } from "../types";

export class CchModule {
  constructor(private client: FiberClient) {}

  /**
   * 发送 BTC
   */
  async sendBtc(params: {
    btc_pay_req: string;
    currency: Currency;
  }): Promise<{
    timestamp: bigint;
    expiry: bigint;
    ckb_final_tlc_expiry_delta: bigint;
    currency: Currency;
    wrapped_btc_type_script: Script;
    btc_pay_req: string;
    ckb_pay_req: string;
    payment_hash: string;
    amount_sats: bigint;
    fee_sats: bigint;
    status: string;
  }> {
    return this.client.call("send_btc", [params]);
  }

  /**
   * 接收 BTC
   */
  async receiveBtc(params: {
    payment_hash: string;
    channel_id: string;
    amount_sats: bigint;
    final_tlc_expiry: bigint;
  }): Promise<{
    timestamp: bigint;
    expiry: bigint;
    ckb_final_tlc_expiry_delta: bigint;
    wrapped_btc_type_script: Script;
    btc_pay_req: string;
    payment_hash: string;
    channel_id: string;
    tlc_id?: bigint;
    amount_sats: bigint;
    status: string;
  }> {
    return this.client.call("receive_btc", [params]);
  }

  /**
   * 获取接收 BTC 订单
   */
  async getReceiveBtcOrder(payment_hash: string): Promise<{
    timestamp: bigint;
    expiry: bigint;
    ckb_final_tlc_expiry_delta: bigint;
    wrapped_btc_type_script: Script;
    btc_pay_req: string;
    payment_hash: string;
    channel_id: string;
    tlc_id?: bigint;
    amount_sats: bigint;
    status: string;
  }> {
    return this.client.call("get_receive_btc_order", [payment_hash]);
  }
} 