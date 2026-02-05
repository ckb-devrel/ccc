import { ccc } from "@ckb-ccc/core";
import { u64ToDecimal } from "../numeric.js";
import { FiberClient } from "../rpc/client.js";
import type { NodeInfo } from "../types.js";

/** Raw RPC response for node_info (camelCase after conversion). */
interface NodeInfoRpcResponse {
  version?: string;
  commitHash?: string;
  nodeName: string;
  addresses: string[];
  nodeId: string;
  timestamp?: string | number;
  chainHash: string;
  openChannelAutoAcceptMinCkbFundingAmount?: string | number;
  autoAcceptMinCkbFundingAmount?: string | number;
  autoAcceptChannelCkbFundingAmount: string | number;
  tlcExpiryDelta: string | number;
  tlcMinValue: string | number;
  tlcFeeProportionalMillionths: string | number;
  channelCount: string;
  pendingChannelCount: string;
  peersCount: string;
  udtCfgInfos: Record<string, unknown>;
  defaultFundingLockScript?: {
    codeHash: string;
    hashType: string;
    args: string;
  };
}

function formatNum(v: string | number | undefined): string {
  if (v == null) return "";
  return typeof v === "string" ? v : ccc.fixedPointToString(v);
}

function formatTimestamp(v: string | number | bigint | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return u64ToDecimal(typeof v === "bigint" ? v : BigInt(Number(v)), true);
}

export class InfoApi {
  constructor(private readonly rpc: FiberClient) {}

  async nodeInfo(): Promise<NodeInfo> {
    const raw = await this.rpc.callCamel<NodeInfoRpcResponse>("node_info", []);
    const minCkb =
      raw.openChannelAutoAcceptMinCkbFundingAmount ??
      raw.autoAcceptMinCkbFundingAmount;
    return {
      version: raw.version,
      commitHash: raw.commitHash,
      nodeName: raw.nodeName,
      addresses: raw.addresses,
      nodeId: raw.nodeId,
      timestamp: formatTimestamp(raw.timestamp),
      chainHash: raw.chainHash,
      openChannelAutoAcceptMinCkbFundingAmount:
        minCkb != null ? String(minCkb) : undefined,
      autoAcceptMinCkbFundingAmount:
        minCkb != null ? formatNum(minCkb) : undefined,
      autoAcceptChannelCkbFundingAmount: formatNum(
        raw.autoAcceptChannelCkbFundingAmount,
      ),
      tlcExpiryDelta: formatNum(raw.tlcExpiryDelta),
      tlcMinValue: formatNum(raw.tlcMinValue),
      tlcFeeProportionalMillionths: formatNum(raw.tlcFeeProportionalMillionths),
      channelCount: raw.channelCount ? String(Number(raw.channelCount)) : "0",
      pendingChannelCount: raw.pendingChannelCount
        ? String(Number(raw.pendingChannelCount))
        : "0",
      peersCount: raw.peersCount ? String(Number(raw.peersCount)) : "0",
      udtCfgInfos: raw.udtCfgInfos,
      defaultFundingLockScript: raw.defaultFundingLockScript,
    };
  }
}
