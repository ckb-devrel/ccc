import { FiberClient } from "./client.js";
import { CchModule } from "./modules/cch.js";
import { ChannelModule } from "./modules/channel.js";
import { DevModule } from "./modules/dev.js";
import { GraphModule } from "./modules/graph.js";
import { InfoModule } from "./modules/info.js";
import { InvoiceModule } from "./modules/invoice.js";
import { PaymentModule } from "./modules/payment.js";
import { PeerInfo, PeerModule } from "./modules/peer.js";
import {
  Channel,
  CkbInvoice,
  Hash256,
  NodeInfo,
  PaymentSessionStatus,
  Script,
} from "./types.js";

export { FiberClient } from "./client.js";
export { CchModule } from "./modules/cch.js";
export { ChannelModule } from "./modules/channel.js";
export { DevModule } from "./modules/dev.js";
export { GraphModule } from "./modules/graph.js";
export { InfoModule } from "./modules/info.js";
export { InvoiceModule } from "./modules/invoice.js";
export { PaymentModule } from "./modules/payment.js";
export { PeerModule } from "./modules/peer.js";
export * from "./types.js";

export type { CchOrderResult } from "./modules/cch.js";
export type { RemoveTlcReasonParam } from "./modules/dev.js";
export type { GraphChannelsResult, GraphNodesResult } from "./modules/graph.js";
export type { NewInvoiceParams, NewInvoiceResult } from "./modules/invoice.js";
export type {
  SendPaymentParams,
  SendPaymentResult,
} from "./modules/payment.js";

export interface FiberSDKConfig {
  endpoint: string;
  timeout?: number;
}

export class FiberSDK {
  public channel: ChannelModule;
  public payment: PaymentModule;
  public invoice: InvoiceModule;
  public peer: PeerModule;
  public info: InfoModule;
  public graph: GraphModule;
  public dev: DevModule;
  public cch: CchModule;

  constructor(config: FiberSDKConfig) {
    const client = new FiberClient({
      endpoint: config.endpoint,
      timeout: config.timeout,
    });

    this.channel = new ChannelModule(client);
    this.payment = new PaymentModule(client);
    this.invoice = new InvoiceModule(client);
    this.peer = new PeerModule(client);
    this.info = new InfoModule(client);
    this.graph = new GraphModule(client);
    this.dev = new DevModule(client);
    this.cch = new CchModule(client);
  }

  /**
   * List all channels (optionally filter by peer_id or include closed).
   */
  async listChannels(params?: {
    peer_id?: string;
    include_closed?: boolean;
  }): Promise<Channel[]> {
    return this.channel.listChannels(params);
  }

  /**
   * Get node information
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.info.nodeInfo();
  }

  /**
   * Open channel
   */
  async openChannel(params: {
    peer_id: string;
    funding_amount: string;
    public?: boolean;
    funding_udt_type_script?: Script;
    shutdown_script?: Script;
    commitment_delay_epoch?: string;
    commitment_fee_rate?: string;
    funding_fee_rate?: string;
    tlc_expiry_delta?: string;
    tlc_min_value?: string;
    tlc_fee_proportional_millionths?: string;
    max_tlc_value_in_flight?: string;
    max_tlc_number_in_flight?: string;
  }): Promise<Hash256> {
    return this.channel.openChannel(params);
  }

  /**
   * Shutdown a channel.
   */
  async shutdownChannel(params: {
    channel_id: Hash256;
    close_script?: Script;
    fee_rate?: string | number;
    force?: boolean;
  }): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  /**
   * Close channel
   */
  async abandonChannel(channel_id: Hash256): Promise<void> {
    return this.channel.abandonChannel(channel_id);
  }

  /**
   * Send a payment (see payment.sendPayment for full params).
   */
  async sendPayment(
    params: import("./modules/payment.js").SendPaymentParams,
  ): Promise<import("./modules/payment.js").SendPaymentResult> {
    return this.payment.sendPayment(params);
  }

  /**
   * Parse invoice
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.invoice.parseInvoice(invoice);
  }

  /**
   * Create a new invoice (see invoice.newInvoice for full params).
   */
  async newInvoice(
    params: import("./modules/invoice.js").NewInvoiceParams,
  ): Promise<import("./modules/invoice.js").NewInvoiceResult> {
    return this.invoice.newInvoice(params);
  }

  /**
   * Get invoice by payment hash.
   */
  async getInvoice(payment_hash: Hash256): Promise<{
    status: import("./types.js").CkbInvoiceStatus;
    invoice_address: string;
    invoice: CkbInvoice;
  }> {
    return this.invoice.getInvoice(payment_hash);
  }

  /**
   * Cancel an invoice (only when status is Open).
   */
  async cancelInvoice(payment_hash: Hash256): Promise<{
    invoice_address: string;
    invoice: CkbInvoice;
    status: import("./types.js").CkbInvoiceStatus;
  }> {
    return this.invoice.cancelInvoice(payment_hash);
  }

  /**
   * Get payment by payment hash.
   */
  async getPayment(payment_hash: Hash256): Promise<{
    status: PaymentSessionStatus;
    payment_hash: Hash256;
    created_at: string | number;
    last_updated_at: string | number;
    failed_error?: string;
    fee: string | number;
    custom_records?: import("./types.js").PaymentCustomRecords;
    router: import("./types.js").SessionRouteNode[];
  }> {
    return this.payment.getPayment(payment_hash);
  }

  /**
   * Connect to a peer (optionally save address to peer store).
   */
  async connectPeer(address: string, save?: boolean): Promise<void> {
    return this.peer.connectPeer(address, save);
  }

  /**
   * Disconnect from node
   */
  async disconnectPeer(peer_id: string): Promise<void> {
    return this.peer.disconnectPeer(peer_id);
  }

  /**
   * List all connected nodes
   */
  async listPeers(): Promise<PeerInfo[]> {
    return this.peer.listPeers();
  }
}

export default FiberSDK;
