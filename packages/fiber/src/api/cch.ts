import { FiberClient } from "../rpc/client.js";
import type {
  CchOrderStatus,
  CkbInvoice,
  Currency,
  Hash256,
  Script,
} from "../types.js";

/** CCH incoming invoice: Fiber (CkbInvoice) or Lightning (Bolt11 string). */
export type CchInvoice = { Fiber: CkbInvoice } | { Lightning: string };

export interface CchOrderResult {
  timestamp: string | number;
  expiry: string | number;
  ckbFinalTlcExpiryDelta: string | number;
  wrappedBtcTypeScript?: Script;
  /** Generated invoice for the incoming payment (Fiber or Lightning). */
  incomingInvoice?: CchInvoice;
  /** Final payee payment request (different network from incoming). */
  outgoingPayReq: string;
  paymentHash: Hash256;
  amountSats: string | number;
  feeSats: string | number;
  status: CchOrderStatus;
}

export class CchApi {
  constructor(private readonly rpc: FiberClient) {}

  /** Send BTC to an address. Params: btc_pay_req, currency. */
  async sendBtc(params: {
    btcPayReq: string;
    currency: Currency;
  }): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("send_btc", [params]);
  }

  /** Receive BTC from a Fiber payment request. Params: fiber_pay_req only. */
  async receiveBtc(params: { fiberPayReq: string }): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("receive_btc", [params]);
  }

  /** Get CCH order by payment hash. */
  async getCchOrder(paymentHash: Hash256): Promise<CchOrderResult> {
    return this.rpc.callCamel<CchOrderResult>("get_cch_order", [
      { paymentHash },
    ]);
  }
}
