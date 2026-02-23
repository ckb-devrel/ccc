import { ccc } from "@ckb-ccc/core";
import { ChannelApi, InvoiceApi, PaymentApi } from "./api/index.js";
import { FiberClient } from "./rpc.js";
import type * as fiber from "./types/index.js";

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
    params?: fiber.ListChannelsParamsLike,
  ): Promise<fiber.Channel[]> {
    return this.channel.listChannels(params);
  }

  async openChannel(params: fiber.OpenChannelParamsLike): Promise<ccc.Hex> {
    return this.channel.openChannel(params);
  }

  async shutdownChannel(
    params: fiber.ShutdownChannelParamsLike,
  ): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  async abandonChannel(params: fiber.AbandonChannelParamsLike): Promise<void> {
    return this.channel.abandonChannel(params);
  }

  async sendPayment(
    params: fiber.SendPaymentParamsLike,
  ): Promise<fiber.PaymentResult> {
    return this.payment.sendPayment(params);
  }

  async parseInvoice(
    params: fiber.ParseInvoiceParamsLike,
  ): Promise<fiber.CkbInvoice> {
    const result = await this.invoice.parseInvoice(params);
    return result.invoice;
  }

  async newInvoice(
    params: fiber.NewInvoiceParamsLike,
  ): Promise<fiber.NewInvoiceResult> {
    return this.invoice.newInvoice(params);
  }

  async getInvoice(paymentHash: ccc.HexLike): Promise<fiber.GetInvoiceResult> {
    return this.invoice.getInvoice({
      paymentHash,
    });
  }

  async cancelInvoice(
    paymentHash: ccc.HexLike,
  ): Promise<fiber.GetInvoiceResult> {
    return this.invoice.cancelInvoice({
      paymentHash,
    });
  }

  async getPayment(paymentHash: ccc.HexLike): Promise<fiber.PaymentResult> {
    return this.payment.getPayment({
      paymentHash,
    });
  }
}

export default FiberSDK;
