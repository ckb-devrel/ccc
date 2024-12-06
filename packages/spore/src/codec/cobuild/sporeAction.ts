import { mol } from "@ckb-ccc/core";

export const Address = mol.union({
  Script: mol.Script,
});

/**
 * Spore
 */
export const CreateSpore = mol.table({
  sporeId: mol.Hash,
  to: Address,
  dataHash: mol.Hash,
});
export const TransferSpore = mol.table({
  sporeId: mol.Hash,
  from: Address,
  to: Address,
});
export const MeltSpore = mol.table({
  sporeId: mol.Hash,
  from: Address,
});

/**
 * Cluster
 */
export const CreateCluster = mol.table({
  clusterId: mol.Hash,
  to: Address,
  dataHash: mol.Hash,
});
export const TransferCluster = mol.table({
  clusterId: mol.Hash,
  from: Address,
  to: Address,
});

/**
 * ClusterProxy
 */
export const CreateClusterProxy = mol.table({
  clusterId: mol.Hash,
  clusterProxyId: mol.Hash,
  to: Address,
});
export const TransferClusterProxy = mol.table({
  clusterId: mol.Hash,
  clusterProxyId: mol.Hash,
  from: Address,
  to: Address,
});
export const MeltClusterProxy = mol.table({
  clusterId: mol.Hash,
  clusterProxyId: mol.Hash,
  from: Address,
});

/**
 * ClusterAgent
 */
export const CreateClusterAgent = mol.table({
  clusterId: mol.Hash,
  clusterProxyId: mol.Hash,
  to: Address,
});
export const TransferClusterAgent = mol.table({
  clusterId: mol.Hash,
  from: Address,
  to: Address,
});
export const MeltClusterAgent = mol.table({
  clusterId: mol.Hash,
  from: Address,
});

/**
 * Spore ScriptInfo Actions
 */
export const SporeAction = mol.union({
  // Spore
  CreateSpore,
  TransferSpore,
  MeltSpore,

  // Cluster
  CreateCluster,
  TransferCluster,

  // ClusterProxy
  CreateClusterProxy,
  TransferClusterProxy,
  MeltClusterProxy,

  // ClusterAgent
  CreateClusterAgent,
  TransferClusterAgent,
  MeltClusterAgent,
});
