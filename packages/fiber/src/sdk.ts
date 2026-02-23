import { ccc } from "@ckb-ccc/core";
import { ChannelApi, InvoiceApi, PaymentApi } from "./api/index.js";
import { FiberClient } from "./rpc.js";
import type * as fiber from "./types.js";

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

  async listChannels(
    params?: fiber.ListChannelsParams,
  ): Promise<fiber.Channel[]> {
    return this.channel.listChannels(params);
  }

  async openChannel(params: fiber.OpenChannelParams): Promise<ccc.Hex> {
    return this.channel.openChannel(params);
  }

  async shutdownChannel(params: fiber.ShutdownChannelParams): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  async abandonChannel(params: fiber.AbandonChannelParams): Promise<void> {
    return this.channel.abandonChannel(params);
  }

  async sendPayment(
    params: fiber.SendPaymentParams,
  ): Promise<fiber.PaymentResult> {
    return this.payment.sendPayment(params);
  }

  async parseInvoice(invoice: string): Promise<fiber.CkbInvoice> {
    const result = await this.invoice.parseInvoice({
      invoice,
    });
    return result.invoice;
  }

  async newInvoice(
    params: fiber.NewInvoiceParams,
  ): Promise<fiber.NewInvoiceResult> {
    return this.invoice.newInvoice(params);
  }

  async getInvoice(paymentHash: ccc.HexLike): Promise<fiber.GetInvoiceResult> {
    return this.invoice.getInvoice({
      paymentHash: ccc.hexFrom(paymentHash),
    });
  }

  async cancelInvoice(
    paymentHash: ccc.HexLike,
  ): Promise<fiber.GetInvoiceResult> {
    return this.invoice.cancelInvoice({
      paymentHash: ccc.hexFrom(paymentHash),
    });
  }

  async getPayment(paymentHash: ccc.HexLike): Promise<fiber.PaymentResult> {
    return this.payment.getPayment({
      paymentHash: ccc.hexFrom(paymentHash),
    });
  }
}

export default FiberSDK;
