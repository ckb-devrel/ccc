import { FiberClient } from "../client.js";
import { CchOrderStatus, Currency, Hash256, Script } from "../types.js";

export interface CchOrderResult {
  timestamp: string | number;
  expiry: string | number;
  ckb_final_tlc_expiry_delta: string | number;
  currency?: Currency;
  wrapped_btc_type_script?: Script;
  btc_pay_req: string;
  ckb_pay_req?: string;
  payment_hash: string;
  channel_id?: Hash256;
  tlc_id?: number;
  amount_sats: string | number;
  fee_sats: string | number;
  status: CchOrderStatus;
}

export class CchModule {
  constructor(private client: FiberClient) {}

  /**
   * Send BTC to an address (cross-chain hub).
   */
  async sendBtc(params: {
    btc_pay_req: string;
    currency: Currency;
  }): Promise<CchOrderResult> {
    return this.client.call<CchOrderResult>("send_btc", [params]);
  }

  /**
   * Receive BTC from a payment hash (cross-chain hub).
   */
  async receiveBtc(params: {
    payment_hash: string;
    channel_id: Hash256;
    amount_sats: string | number;
    final_tlc_expiry: string | number;
  }): Promise<CchOrderResult> {
    return this.client.call<CchOrderResult>("receive_btc", [params]);
  }

  /**
   * Get receive BTC order by payment hash.
   */
  async getReceiveBtcOrder(payment_hash: string): Promise<CchOrderResult> {
    return this.client.call<CchOrderResult>("get_receive_btc_order", [
      payment_hash,
    ]);
  }
}
