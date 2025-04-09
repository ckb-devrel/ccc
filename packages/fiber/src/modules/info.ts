import { FiberClient } from "../client.js";
import { NodeInfo } from "../types.js";

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * Get node information
   * @returns Returns detailed node information, including node name, address, ID, etc.
   * @throws {Error} Throws error when unable to get node information
   */
  async nodeInfo(): Promise<NodeInfo> {
    //转换nodeInfo中的十六进制数字为十进制数字
    //包括channel_count,peers_count,pending_channel_count,tlc_expiry_delta,tlc_fee_proportional_millionths,tlc_max_value,tlc_min_value,open_channel_auto_accept_min_ckb_funding_amount,auto_accept_channel_ckb_funding_amount
    const nodeInfo = await this.client.call<{
      node_name: string;
      addresses: string[];
      node_id: string;
      timestamp: string;
      chain_hash: string;
      auto_accept_min_ckb_funding_amount: string;
      udt_cfg_infos: Record<string, unknown>;
      default_funding_lock_script?: {
        code_hash: string;
        hash_type: string;
        args: string;
      };
    }>("node_info", []);
    if (nodeInfo) {
      const nodeInfoWithDecimal: NodeInfo = {
        node_name: nodeInfo.node_name || "",
        addresses: nodeInfo.addresses || [],
        node_id: nodeInfo.node_id || "",
        timestamp: nodeInfo.timestamp ? BigInt(nodeInfo.timestamp) : BigInt(0),
        chain_hash: nodeInfo.chain_hash || "",
        auto_accept_min_ckb_funding_amount:
          nodeInfo.auto_accept_min_ckb_funding_amount
            ? BigInt(nodeInfo.auto_accept_min_ckb_funding_amount)
            : BigInt(0),
        udt_cfg_infos: nodeInfo.udt_cfg_infos || {},
        default_funding_lock_script: nodeInfo.default_funding_lock_script
          ? {
              code_hash: nodeInfo.default_funding_lock_script.code_hash || "",
              hash_type: nodeInfo.default_funding_lock_script.hash_type || "",
              args: nodeInfo.default_funding_lock_script.args || "",
            }
          : undefined,
      };
      return nodeInfoWithDecimal;
    }
    throw new Error("无法获取节点信息");
  }
}
