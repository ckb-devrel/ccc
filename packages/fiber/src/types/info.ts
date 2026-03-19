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
  nodeId: string;
  nodeName?: string;
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
