import { ccc, mol } from "@ckb-ccc/core";

export const Address = mol.union({
  Script: ccc.Script,
});

/**
 * Spore
 */
export const CreateSpore = mol.table({
  sporeId: mol.Byte32,
  to: Address,
  dataHash: mol.Byte32,
});
export const TransferSpore = mol.table({
  sporeId: mol.Byte32,
  from: Address,
  to: Address,
});
export const MeltSpore = mol.table({
  sporeId: mol.Byte32,
  from: Address,
});

/**
 * Cluster
 */
export const CreateCluster = mol.table({
  clusterId: mol.Byte32,
  to: Address,
  dataHash: mol.Byte32,
});
export const TransferCluster = mol.table({
  clusterId: mol.Byte32,
  from: Address,
  to: Address,
});

/**
 * ClusterProxy
 */
export const CreateClusterProxy = mol.table({
  clusterId: mol.Byte32,
  clusterProxyId: mol.Byte32,
  to: Address,
});
export const TransferClusterProxy = mol.table({
  clusterId: mol.Byte32,
  clusterProxyId: mol.Byte32,
  from: Address,
  to: Address,
});
export const MeltClusterProxy = mol.table({
  clusterId: mol.Byte32,
  clusterProxyId: mol.Byte32,
  from: Address,
});

/**
 * ClusterAgent
 */
export const CreateClusterAgent = mol.table({
  clusterId: mol.Byte32,
  clusterProxyId: mol.Byte32,
  to: Address,
});
export const TransferClusterAgent = mol.table({
  clusterId: mol.Byte32,
  from: Address,
  to: Address,
});
export const MeltClusterAgent = mol.table({
  clusterId: mol.Byte32,
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
