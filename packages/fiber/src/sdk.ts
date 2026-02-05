import {
  CchApi,
  ChannelApi,
  DevApi,
  GraphApi,
  InfoApi,
  InvoiceApi,
  PaymentApi,
  PeerApi,
} from "./api/index.js";
import type { PeerInfo } from "./api/peer.js";
import { FiberClient } from "./rpc/client.js";
import type {
  Channel,
  CkbInvoice,
  Hash256,
  NodeInfo,
  PaymentCustomRecords,
  PaymentSessionStatus,
  Script,
  SessionRouteNode,
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
  readonly peer: PeerApi;
  readonly info: InfoApi;
  readonly graph: GraphApi;
  readonly dev: DevApi;
  readonly cch: CchApi;

  constructor(config: FiberSDKConfig) {
    const rpc = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });
    this.channel = new ChannelApi(rpc);
    this.payment = new PaymentApi(rpc);
    this.invoice = new InvoiceApi(rpc);
    this.peer = new PeerApi(rpc);
    this.info = new InfoApi(rpc);
    this.graph = new GraphApi(rpc);
    this.dev = new DevApi(rpc);
    this.cch = new CchApi(rpc);
  }

  async listChannels(params?: {
    peerId?: string;
    includeClosed?: boolean;
  }): Promise<Channel[]> {
    return this.channel.listChannels(params);
  }

  async nodeInfo(): Promise<NodeInfo> {
    return this.info.nodeInfo();
  }

  async openChannel(params: {
    peerId: string;
    fundingAmount: string;
    public?: boolean;
    fundingUdtTypeScript?: Script;
    shutdownScript?: Script;
    commitmentDelayEpoch?: string;
    commitmentFeeRate?: string;
    fundingFeeRate?: string;
    tlcExpiryDelta?: string;
    tlcMinValue?: string;
    tlcFeeProportionalMillionths?: string;
    maxTlcValueInFlight?: string;
    maxTlcNumberInFlight?: string;
  }): Promise<Hash256> {
    return this.channel.openChannel(params);
  }

  async shutdownChannel(params: {
    channelId: Hash256;
    closeScript?: Script;
    feeRate?: string | number;
    force?: boolean;
  }): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  async abandonChannel(channelId: Hash256): Promise<void> {
    return this.channel.abandonChannel(channelId);
  }

  async sendPayment(
    params: import("./api/payment.js").SendPaymentParams,
  ): Promise<import("./api/payment.js").SendPaymentResult> {
    return this.payment.sendPayment(params);
  }

  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.invoice.parseInvoice(invoice);
  }

  async newInvoice(
    params: import("./api/invoice.js").NewInvoiceParams,
  ): Promise<import("./api/invoice.js").NewInvoiceResult> {
    return this.invoice.newInvoice(params);
  }

  async getInvoice(paymentHash: Hash256): Promise<{
    status: import("./types.js").CkbInvoiceStatus;
    invoiceAddress: string;
    invoice: CkbInvoice;
  }> {
    return this.invoice.getInvoice(paymentHash);
  }

  async cancelInvoice(paymentHash: Hash256): Promise<{
    invoiceAddress: string;
    invoice: CkbInvoice;
    status: import("./types.js").CkbInvoiceStatus;
  }> {
    return this.invoice.cancelInvoice(paymentHash);
  }

  async getPayment(paymentHash: Hash256): Promise<{
    status: PaymentSessionStatus;
    paymentHash: Hash256;
    createdAt: string | number;
    lastUpdatedAt: string | number;
    failedError?: string;
    fee: string | number;
    customRecords?: PaymentCustomRecords;
    router: SessionRouteNode[];
  }> {
    return this.payment.getPayment(paymentHash);
  }

  async connectPeer(address: string, save?: boolean): Promise<void> {
    return this.peer.connectPeer(address, save);
  }

  async disconnectPeer(peerId: string): Promise<void> {
    return this.peer.disconnectPeer(peerId);
  }

  async listPeers(): Promise<PeerInfo[]> {
    return this.peer.listPeers();
  }
}

export default FiberSDK;
