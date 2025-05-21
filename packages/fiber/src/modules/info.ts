import { fixedPointToString } from "@ckb-ccc/core";
import { FiberClient } from "../client.js";
import { NodeInfo } from "../types.js";
import { u64ToDecimal } from "../utils/number.js";

interface RawNodeInfo {
  node_name: string;
  addresses: string[];
  node_id: string;
  timestamp: bigint;
  chain_hash: string;
  auto_accept_min_ckb_funding_amount: bigint;
  auto_accept_channel_ckb_funding_amount: bigint;
  tlc_expiry_delta: bigint;
  tlc_min_value: bigint;
  tlc_fee_proportional_millionths: bigint;
  channel_count: string;
  pending_channel_count: string;
  peers_count: string;
  udt_cfg_infos: Record<string, unknown>;
  default_funding_lock_script?: {
    code_hash: string;
    hash_type: string;
    args: string;
  };
}

export class InfoModule {
  constructor(private client: FiberClient) {}

  /**
   * Get node information
   * @returns Returns detailed node information, including node name, address, ID, etc.
   * @throws {Error} Throws error when unable to get node information
   */
  async nodeInfo(): Promise<NodeInfo> {
    const response = await this.client.call<RawNodeInfo>("node_info", []);
    return {
      node_name: response.node_name,
      addresses: response.addresses,
      node_id: response.node_id,
      timestamp: response.timestamp
        ? u64ToDecimal(response.timestamp, true)
        : "",
      chain_hash: response.chain_hash,
      auto_accept_min_ckb_funding_amount:
        response.auto_accept_min_ckb_funding_amount
          ? fixedPointToString(response.auto_accept_min_ckb_funding_amount)
          : "",
      auto_accept_channel_ckb_funding_amount:
        response.auto_accept_channel_ckb_funding_amount
          ? fixedPointToString(response.auto_accept_channel_ckb_funding_amount)
          : "",
      tlc_expiry_delta: response.tlc_expiry_delta
        ? fixedPointToString(response.tlc_expiry_delta)
        : "",
      tlc_min_value: response.tlc_min_value
        ? fixedPointToString(response.tlc_min_value)
        : "",
      tlc_fee_proportional_millionths: response.tlc_fee_proportional_millionths
        ? fixedPointToString(response.tlc_fee_proportional_millionths)
        : "",
      channel_count: response.channel_count
        ? Number(response.channel_count).toString()
        : "0",
      pending_channel_count: response.pending_channel_count
        ? Number(response.pending_channel_count).toString()
        : "0",
      peers_count: response.peers_count
        ? Number(response.peers_count).toString()
        : "0",
      udt_cfg_infos: response.udt_cfg_infos,
      default_funding_lock_script: response.default_funding_lock_script,
    };
  }
}
