import { FiberClient } from "./client.js";
import { ChannelModule } from "./modules/channel.js";
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
export { ChannelModule } from "./modules/channel.js";
export { InfoModule } from "./modules/info.js";
export { InvoiceModule } from "./modules/invoice.js";
export { PaymentModule } from "./modules/payment.js";
export { PeerModule } from "./modules/peer.js";
export * from "./types.js";

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
  // public graph: GraphModule;
  // public dev: DevModule;
  // public cch: CchModule;

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
    // this.graph = new GraphModule(client);
    // this.dev = new DevModule(client);
    // this.cch = new CchModule(client);
  }

  /**
   * 列出所有通道
   */
  async listChannels(): Promise<Channel[]> {
    return this.channel.listChannels();
  }

  /**
   * 获取节点信息
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.info.nodeInfo();
  }

  /**
   * 打开通道
   */
  async openChannel(params: {
    peer_id: string;
    funding_amount: bigint;
    public?: boolean;
    funding_udt_type_script?: Script;
    shutdown_script?: Script;
    commitment_delay_epoch?: bigint;
    commitment_fee_rate?: bigint;
    funding_fee_rate?: bigint;
    tlc_expiry_delta?: bigint;
    tlc_min_value?: bigint;
    tlc_fee_proportional_millionths?: bigint;
    max_tlc_value_in_flight?: bigint;
    max_tlc_number_in_flight?: bigint;
  }): Promise<Hash256> {
    return this.channel.openChannel(params);
  }

  /**
   * 关闭通道
   */
  async shutdownChannel(params: {
    channel_id: Hash256;
    close_script: Script;
    force?: boolean;
    fee_rate: bigint;
  }): Promise<void> {
    return this.channel.shutdownChannel(params);
  }

  /**
   * 关闭通道
   /**
    * 关闭通道
    */
  async abandonChannel(channel_id: Hash256): Promise<void> {
    return this.channel.abandonChannel(channel_id);
  }

  /**
   * 发送支付
   */
  async sendPayment(params: {
    payment_hash: string;
    amount: bigint;
    fee_rate: bigint;
  }): Promise<void> {
    return this.payment.sendPayment(params);
  }

  /**
   * 解析发票
   */
  async parseInvoice(invoice: string): Promise<CkbInvoice> {
    return this.invoice.parseInvoice(invoice);
  }

  /**
   * 创建新发票
   */
  async newInvoice(params: {
    amount: bigint;
    description?: string;
    expiry?: bigint;
    payment_secret?: string;
  }): Promise<CkbInvoice> {
    return this.invoice.newInvoice(params);
  }

  /**
   * 获取发票信息
   */
  async getInvoice(payment_hash: string): Promise<{
    status: string;
    invoice_address: string;
    invoice: CkbInvoice;
  }> {
    return this.invoice.getInvoice(payment_hash);
  }

  /**
   * 取消发票
   */
  async cancelInvoice(payment_hash: string): Promise<void> {
    return this.invoice.cancelInvoice(payment_hash);
  }

  /**
   * 获取支付信息
   */
  async getPayment(payment_hash: string): Promise<{
    status: PaymentSessionStatus;
    payment_hash: Hash256;
    created_at: bigint;
    last_updated_at: bigint;
    failed_error?: string;
    fee: bigint;
  }> {
    return this.payment.getPayment(payment_hash);
  }

  /**
   * 连接节点
   */
  async connectPeer(address: string): Promise<void> {
    return this.peer.connectPeer(address);
  }

  /**
   * 断开节点连接
   */
  async disconnectPeer(peer_id: string): Promise<void> {
    return this.peer.disconnectPeer(peer_id);
  }

  /**
   * 列出所有连接的节点
   */
  async listPeers(): Promise<PeerInfo[]> {
    return this.peer.listPeers();
  }
}

export default FiberSDK;
