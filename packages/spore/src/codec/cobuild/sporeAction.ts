import { codec } from "@ckb-ccc/core";

const Hash = codec.Byte32;

export const Address = codec.union(
  {
    Script: codec.Script,
  },
  ["Script"],
);

/**
 * Spore
 */
export const CreateSpore = codec.table(
  {
    sporeId: Hash,
    to: Address,
    dataHash: Hash,
  },
  ["sporeId", "to", "dataHash"],
);
export const TransferSpore = codec.table(
  {
    sporeId: Hash,
    from: Address,
    to: Address,
  },
  ["sporeId", "from", "to"],
);
export const MeltSpore = codec.table(
  {
    sporeId: Hash,
    from: Address,
  },
  ["sporeId", "from"],
);

/**
 * Cluster
 */
export const CreateCluster = codec.table(
  {
    clusterId: Hash,
    to: Address,
    dataHash: Hash,
  },
  ["clusterId", "to", "dataHash"],
);
export const TransferCluster = codec.table(
  {
    clusterId: Hash,
    from: Address,
    to: Address,
  },
  ["clusterId", "from", "to"],
);

/**
 * ClusterProxy
 */
export const CreateClusterProxy = codec.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "to"],
);
export const TransferClusterProxy = codec.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    from: Address,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "from", "to"],
);
export const MeltClusterProxy = codec.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    from: Address,
  },
  ["clusterId", "clusterProxyId", "from"],
);

/**
 * ClusterAgent
 */
export const CreateClusterAgent = codec.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "to"],
);
export const TransferClusterAgent = codec.table(
  {
    clusterId: Hash,
    from: Address,
    to: Address,
  },
  ["clusterId", "from", "to"],
);
export const MeltClusterAgent = codec.table(
  {
    clusterId: Hash,
    from: Address,
  },
  ["clusterId", "from"],
);

/**
 * Spore ScriptInfo Actions
 */
export const SporeAction = codec.union(
  {
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
  },
  [
    "CreateSpore",
    "TransferSpore",
    "MeltSpore",
    "CreateCluster",
    "TransferCluster",
    "CreateClusterProxy",
    "TransferClusterProxy",
    "MeltClusterProxy",
    "CreateClusterAgent",
    "TransferClusterAgent",
    "MeltClusterAgent",
  ],
);
