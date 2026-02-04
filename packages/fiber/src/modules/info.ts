import { fixedPointToString } from "@ckb-ccc/core";
import { FiberClient } from "../client.js";
import { NodeInfo } from "../types.js";
import { u64ToDecimal } from "../utils/number.js";

interface RawNodeInfo {
  version?: string;
  commit_hash?: string;
  node_name: string;
  addresses: string[];
  node_id: string;
  timestamp?: string | number;
  chain_hash: string;
  open_channel_auto_accept_min_ckb_funding_amount?: string | number;
  auto_accept_min_ckb_funding_amount?: string | number;
  auto_accept_channel_ckb_funding_amount: string | number;
  tlc_expiry_delta: string | number;
  tlc_min_value: string | number;
  tlc_fee_proportional_millionths: string | number;
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
    const minCkb =
      response.open_channel_auto_accept_min_ckb_funding_amount ??
      response.auto_accept_min_ckb_funding_amount;
    return {
      version: response.version,
      commit_hash: response.commit_hash,
      node_name: response.node_name,
      addresses: response.addresses,
      node_id: response.node_id,
      timestamp:
        response.timestamp != null
          ? typeof response.timestamp === "string"
            ? response.timestamp
            : u64ToDecimal(
                typeof response.timestamp === "bigint"
                  ? response.timestamp
                  : BigInt(Number(response.timestamp)),
                true,
              )
          : "",
      chain_hash: response.chain_hash,
      open_channel_auto_accept_min_ckb_funding_amount:
        minCkb != null ? String(minCkb) : undefined,
      auto_accept_min_ckb_funding_amount:
        minCkb != null ? fixedPointToString(minCkb) : undefined,
      auto_accept_channel_ckb_funding_amount:
        response.auto_accept_channel_ckb_funding_amount != null
          ? fixedPointToString(response.auto_accept_channel_ckb_funding_amount)
          : "",
      tlc_expiry_delta:
        response.tlc_expiry_delta != null
          ? fixedPointToString(response.tlc_expiry_delta)
          : "",
      tlc_min_value:
        response.tlc_min_value != null
          ? fixedPointToString(response.tlc_min_value)
          : "",
      tlc_fee_proportional_millionths:
        response.tlc_fee_proportional_millionths != null
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
