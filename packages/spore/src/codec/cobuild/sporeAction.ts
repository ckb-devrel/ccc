import { molecule } from "@ckb-ccc/core";

export const Address = molecule.union({
  Script: molecule.Script,
});

/**
 * Spore
 */
export const CreateSpore = molecule.table({
  sporeId: molecule.Hash,
  to: Address,
  dataHash: molecule.Hash,
});
export const TransferSpore = molecule.table({
  sporeId: molecule.Hash,
  from: Address,
  to: Address,
});
export const MeltSpore = molecule.table({
  sporeId: molecule.Hash,
  from: Address,
});

/**
 * Cluster
 */
export const CreateCluster = molecule.table({
  clusterId: molecule.Hash,
  to: Address,
  dataHash: molecule.Hash,
});
export const TransferCluster = molecule.table({
  clusterId: molecule.Hash,
  from: Address,
  to: Address,
});

/**
 * ClusterProxy
 */
export const CreateClusterProxy = molecule.table({
  clusterId: molecule.Hash,
  clusterProxyId: molecule.Hash,
  to: Address,
});
export const TransferClusterProxy = molecule.table({
  clusterId: molecule.Hash,
  clusterProxyId: molecule.Hash,
  from: Address,
  to: Address,
});
export const MeltClusterProxy = molecule.table({
  clusterId: molecule.Hash,
  clusterProxyId: molecule.Hash,
  from: Address,
});

/**
 * ClusterAgent
 */
export const CreateClusterAgent = molecule.table({
  clusterId: molecule.Hash,
  clusterProxyId: molecule.Hash,
  to: Address,
});
export const TransferClusterAgent = molecule.table({
  clusterId: molecule.Hash,
  from: Address,
  to: Address,
});
export const MeltClusterAgent = molecule.table({
  clusterId: molecule.Hash,
  from: Address,
});

/**
 * Spore ScriptInfo Actions
 */
export const SporeAction = molecule.union({
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
