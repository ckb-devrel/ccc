import { FiberClient } from "../client.js";
import {
  Hash256,
  HopHint,
  HopRequire,
  PaymentCustomRecords,
  PaymentSessionStatus,
  RouterHop,
  SessionRouteNode,
} from "../types.js";

export interface SendPaymentParams {
  target_pubkey?: string;
  amount?: string | number;
  payment_hash?: Hash256;
  final_tlc_expiry_delta?: string | number;
  tlc_expiry_limit?: string | number;
  invoice?: string;
  timeout?: string | number;
  max_fee_amount?: string | number;
  max_parts?: number;
  keysend?: boolean;
  udt_type_script?: { code_hash: string; hash_type: string; args: string };
  allow_self_payment?: boolean;
  custom_records?: PaymentCustomRecords;
  hop_hints?: HopHint[];
  dry_run?: boolean;
}

export interface SendPaymentResult {
  payment_hash: Hash256;
  status: PaymentSessionStatus;
  created_at: string | number;
  last_updated_at: string | number;
  failed_error?: string;
  fee: string | number;
  custom_records?: PaymentCustomRecords;
  router: SessionRouteNode[];
}

export class PaymentModule {
  constructor(private client: FiberClient) {}

  /**
   * Send a payment to a peer.
   * Either target_pubkey + amount/payment_hash, or invoice, or keysend must be provided.
   */
  async sendPayment(params: SendPaymentParams): Promise<SendPaymentResult> {
    return this.client.call<SendPaymentResult>("send_payment", [params]);
  }

  /**
   * Get payment by payment hash.
   */
  async getPayment(payment_hash: Hash256): Promise<{
    payment_hash: Hash256;
    status: PaymentSessionStatus;
    created_at: string | number;
    last_updated_at: string | number;
    failed_error?: string;
    fee: string | number;
    custom_records?: PaymentCustomRecords;
    router: SessionRouteNode[];
  }> {
    return this.client.call("get_payment", [payment_hash]);
  }

  /**
   * Build a router with a list of pubkeys and required channels.
   * @param amount - Optional amount (default: minimum routable 1).
   * @param udt_type_script - Optional UDT type script for the payment.
   * @param hops_info - List of hops (does not include source); each hop can specify channel_outpoint.
   * @param final_tlc_expiry_delta - Optional TLC expiry delta for the final hop (milliseconds).
   */
  async buildRouter(params: {
    amount?: string | number;
    udt_type_script?: { code_hash: string; hash_type: string; args: string };
    hops_info: HopRequire[];
    final_tlc_expiry_delta?: string | number;
  }): Promise<{ router_hops: RouterHop[] }> {
    return this.client.call("build_router", [params]);
  }

  /**
   * Send a payment with a manually specified router (e.g. for rebalancing).
   */
  async sendPaymentWithRouter(params: {
    payment_hash?: Hash256;
    router: RouterHop[];
    invoice?: string;
    custom_records?: PaymentCustomRecords;
    keysend?: boolean;
    udt_type_script?: { code_hash: string; hash_type: string; args: string };
    dry_run?: boolean;
  }): Promise<SendPaymentResult> {
    return this.client.call<SendPaymentResult>("send_payment_with_router", [
      params,
    ]);
  }
}
