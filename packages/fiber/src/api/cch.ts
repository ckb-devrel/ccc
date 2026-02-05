import { FiberClient } from "../rpc/client.js";
import type { CchOrderStatus, Currency, Hash256, Script } from "../types.js";

export interface CchOrderResult {
  timestamp: string | number;
  expiry: string | number;
  ckbFinalTlcExpiryDelta: string | number;
  currency?: Currency;
  wrappedBtcTypeScript?: Script;
  btcPayReq: string;
  ckbPayReq?: string;
  paymentHash: string;
  channelId?: Hash256;
  tlcId?: number;
  amountSats: string | number;
  feeSats: string | number;
  status: CchOrderStatus;
}

export class CchApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendBtc(params: {
    btcPayReq: string;
    currency: Currency;
  }): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("send_btc", [params]);
  }

  async receiveBtc(params: {
    paymentHash: string;
    channelId: Hash256;
    amountSats: string | number;
    finalTlcExpiry: string | number;
  }): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("receive_btc", [params]);
  }

  async getReceiveBtcOrder(paymentHash: string): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("get_receive_btc_order", [
      paymentHash,
    ]);
  }
}
