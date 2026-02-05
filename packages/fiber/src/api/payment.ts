import { FiberClient } from "../rpc/client.js";
import type {
  Hash256,
  HopHint,
  HopRequire,
  PaymentCustomRecords,
  PaymentSessionStatus,
  RouterHop,
  Script,
  SessionRouteNode,
} from "../types.js";

export interface SendPaymentParams {
  targetPubkey?: string;
  amount?: string | number;
  paymentHash?: Hash256;
  finalTlcExpiryDelta?: string | number;
  tlcExpiryLimit?: string | number;
  invoice?: string;
  timeout?: string | number;
  maxFeeAmount?: string | number;
  maxParts?: number;
  keysend?: boolean;
  udtTypeScript?: Script;
  allowSelfPayment?: boolean;
  customRecords?: PaymentCustomRecords;
  hopHints?: HopHint[];
  dryRun?: boolean;
}

export interface SendPaymentResult {
  paymentHash: Hash256;
  status: PaymentSessionStatus;
  createdAt: string | number;
  lastUpdatedAt: string | number;
  failedError?: string;
  fee: string | number;
  customRecords?: PaymentCustomRecords;
  router: SessionRouteNode[];
}

/** RPC response for get_payment. */
export interface GetPaymentResult {
  paymentHash: Hash256;
  status: PaymentSessionStatus;
  createdAt: string | number;
  lastUpdatedAt: string | number;
  failedError?: string;
  fee: string | number;
  customRecords?: PaymentCustomRecords;
  router: SessionRouteNode[];
}

/** RPC response for build_router. */
export interface BuildRouterResult {
  routerHops: RouterHop[];
}

export class PaymentApi {
  constructor(private readonly rpc: FiberClient) {}

  async sendPayment(params: SendPaymentParams): Promise<SendPaymentResult> {
    return this.rpc.callCamel<SendPaymentResult>("send_payment", [params]);
  }

  async getPayment(paymentHash: Hash256): Promise<GetPaymentResult> {
    return this.rpc.callCamel<GetPaymentResult>("get_payment", [paymentHash]);
  }

  async buildRouter(params: {
    amount?: string | number;
    udtTypeScript?: Script;
    hopsInfo: HopRequire[];
    finalTlcExpiryDelta?: string | number;
  }): Promise<BuildRouterResult> {
    return this.rpc.callCamel<BuildRouterResult>("build_router", [params]);
  }

  async sendPaymentWithRouter(params: {
    paymentHash?: Hash256;
    router: RouterHop[];
    invoice?: string;
    customRecords?: PaymentCustomRecords;
    keysend?: boolean;
    udtTypeScript?: Script;
    dryRun?: boolean;
  }): Promise<SendPaymentResult> {
    return this.rpc.callCamel<SendPaymentResult>("send_payment_with_router", [
      params,
    ]);
  }
}
