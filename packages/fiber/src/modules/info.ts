import { FiberClient } from "../core/client";
import { NodeInfo } from "../types";

export interface NodeStatus {
  is_online: boolean;
  last_sync_time: bigint;
  connected_peers: number;
  total_channels: number;
}

export interface NodeVersion {
  version: string;
  commit_hash: string;
  build_time: string;
}

export interface NetworkInfo {
  network_type: "mainnet" | "testnet" | "devnet";
  chain_hash: string;
  block_height: bigint;
  block_hash: string;
}

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * 获取节点基本信息
   *
   * @returns {Promise<NodeInfo>} 包含节点详细信息的对象，包括：
   * - version: 节点软件版本
   * - commit_hash: 节点软件的提交哈希
   * - node_id: 节点的身份公钥
   * - node_name: 节点名称（可选）
   * - addresses: 节点的多地址列表
   * - chain_hash: 节点连接的区块链哈希
   * - open_channel_auto_accept_min_ckb_funding_amount: 自动接受开放通道请求的最小 CKB 资金金额
   * - auto_accept_channel_ckb_funding_amount: 自动接受通道请求的 CKB 资金金额
   * - default_funding_lock_script: 节点的默认资金锁定脚本
   * - tlc_expiry_delta: 时间锁定合约（TLC）的过期增量
   * - tlc_min_value: 可以发送的 TLC 最小值
   * - tlc_max_value: 可以发送的 TLC 最大值（0 表示无限制）
   * - tlc_fee_proportional_millionths: TLC 转发支付的费用比例（以百万分之一为单位）
   * - channel_count: 节点关联的通道数量
   * - pending_channel_count: 节点关联的待处理通道数量
   * - peers_count: 连接到节点的对等节点数量
   * - udt_cfg_infos: 节点关联的用户自定义代币（UDT）配置信息
   */
  async nodeInfo(): Promise<NodeInfo> {
    return this.client.call("node_info");
  }

  /**
   * 获取节点状态信息
   */
  async nodeStatus(): Promise<NodeStatus> {
    return this.client.call("node_status");
  }

  /**
   * 获取节点版本信息
   */
  async nodeVersion(): Promise<NodeVersion> {
    return this.client.call("node_version");
  }

  /**
   * 获取网络信息
   */
  async networkInfo(): Promise<NetworkInfo> {
    return this.client.call("network_info");
  }
}
