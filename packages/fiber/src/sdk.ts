import { ccc } from "@ckb-ccc/core";
import {
  ChannelApi,
  InfoApi,
  InvoiceApi,
  PaymentApi,
  PeerApi,
} from "./api/index.js";
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
  readonly info: InfoApi;
  readonly peer: PeerApi;

  constructor(config: FiberSDKConfig) {
    const rpc = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });
    this.channel = new ChannelApi(rpc);
    this.payment = new PaymentApi(rpc);
    this.invoice = new InvoiceApi(rpc);
    this.info = new InfoApi(rpc);
    this.peer = new PeerApi(rpc);
  }

  async getNodeInfo(): Promise<fiber.NodeInfo> {
    return this.info.getNodeInfo();
  }

  async listChannels(
    params?: fiber.ListChannelsParamsLike,
  ): Promise<fiber.Channel[]> {
    return this.channel.listChannels(params);
  }

  async openChannel(params: fiber.OpenChannelParamsLike): Promise<ccc.Hex> {
    return this.channel.openChannel(params);
  }

  async acceptChannel(params: fiber.AcceptChannelParamsLike): Promise<ccc.Hex> {
    return this.channel.acceptChannel(params);
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
    params: fiber.SendPaymentCommandParamsLike,
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

  async connectPeer(params: fiber.ConnectPeerParamsLike): Promise<void> {
    return this.peer.connectPeer(params);
  }

  async disconnectPeer(params: fiber.DisconnectPeerParamsLike): Promise<void> {
    return this.peer.disconnectPeer(params);
  }

  async listPeers(): Promise<fiber.PeerInfo[]> {
    return this.peer.listPeers();
  }
}

export default FiberSDK;
