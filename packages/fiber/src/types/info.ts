/**
 * Node info RPC types (camelCase). Aligned with @nervosnetwork/fiber-js NodeInfoResult
 * (https://github.com/nervosnetwork/fiber/blob/develop/fiber-js/src/types/info.ts)
 * and graph UdtCfgInfos (fiber-js/src/types/graph.ts).
 */
import { ccc } from "@ckb-ccc/core";

export type UdtDep = {
  cellDep?: ccc.CellDep;
  typeId?: ccc.Script;
};

export type UdtArgInfo = {
  name: string;
  script: ccc.Script;
  autoAcceptAmount?: ccc.Hex;
  cellDeps: UdtDep[];
};

export type UdtCfgInfos = UdtArgInfo[];

export type NodeInfo = {
  version: string;
  commitHash: string;
  /** P2P node identifier (e.g. libp2p peer ID). */
  nodeId: string;
  nodeName?: string;
  /** Listen addresses (e.g. /ip4/127.0.0.1/tcp/port/p2p/nodeId). */
  addresses: string[];
  chainHash: ccc.Hex;
  openChannelAutoAcceptMinCkbFundingAmount: ccc.Hex;
  autoAcceptChannelCkbFundingAmount: ccc.Hex;
  defaultFundingLockScript: ccc.Script;
  tlcExpiryDelta: ccc.Hex;
  tlcMinValue: ccc.Hex;
  tlcFeeProportionalMillionths: ccc.Hex;
  channelCount: ccc.Hex;
  pendingChannelCount: ccc.Hex;
  peersCount: ccc.Hex;
  udtCfgInfos: UdtCfgInfos;
};
