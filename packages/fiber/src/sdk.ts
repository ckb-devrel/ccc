import { ChannelApi, InvoiceApi, PaymentApi } from "./api/index.js";
import { FiberClient } from "./rpc/client.js";
import type {
  AbandonChannelParams,
  Channel,
  CkbInvoice,
  GetInvoiceResult,
  Hash256,
  ListChannelsParams,
  NewInvoiceParams,
  NewInvoiceResult,
  OpenChannelParams,
  PaymentCustomRecords,
  PaymentResult,
  PaymentStatus,
  SendPaymentParams,
  SessionRouteNode,
  ShutdownChannelParams,
} from "./types.js";

export interface FiberSDKConfig {
  endpoint: string;
  timeout?: number;
}

/**
 * High-level SDK for the Fiber node RPC. All params and return types use camelCase (CCC convention).
 */
export class FiberSDK {
  readonly channel: ChannelApi;
  readonly payment: PaymentApi;
  readonly invoice: InvoiceApi;

  constructor(config: FiberSDKConfig) {
    const rpc = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });
    this.channel = new ChannelApi(rpc);
    this.payment = new PaymentApi(rpc);
    this.invoice = new InvoiceApi(rpc);
  }

  async listChannels(params?: ListChannelsParams): Promise<Channel[]> {
    return this.channel.listChannels(params);
  }

  async openChannel(params: OpenChannelParams): Promise<Hash256> {
    return this.channel.openChannel(params);
  }

  async shutdownChannel(params: ShutdownChannelParams): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  async abandonChannel(params: AbandonChannelParams): Promise<void> {
    return this.channel.abandonChannel(params);
  }

  async sendPayment(params: SendPaymentParams): Promise<PaymentResult> {
    return this.payment.sendPayment(params);
  }

  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.invoice.parseInvoice(invoice);
  }

  async newInvoice(params: NewInvoiceParams): Promise<NewInvoiceResult> {
    return this.invoice.newInvoice(params);
  }

  async getInvoice(paymentHash: Hash256): Promise<GetInvoiceResult> {
    return this.invoice.getInvoice(paymentHash);
  }

  async cancelInvoice(paymentHash: Hash256): Promise<GetInvoiceResult> {
    return this.invoice.cancelInvoice(paymentHash);
  }

  async getPayment(paymentHash: Hash256): Promise<{
    status: PaymentStatus;
    paymentHash: Hash256;
    createdAt: string | number;
    lastUpdatedAt: string | number;
    failedError?: string;
    fee: string | number;
    customRecords?: PaymentCustomRecords;
    router?: SessionRouteNode[];
  }> {
    return this.payment.getPayment(paymentHash);
  }
}

export default FiberSDK;
