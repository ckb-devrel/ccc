import { blockchain, molecule } from "@ckb-ccc/codec";

const Hash = blockchain.Byte32;

export const Address = molecule.union(
  {
    Script: blockchain.Script,
  },
  ["Script"],
);

/**
 * Spore
 */
export const CreateSpore = molecule.table(
  {
    sporeId: Hash,
    to: Address,
    dataHash: Hash,
  },
  ["sporeId", "to", "dataHash"],
);
export const TransferSpore = molecule.table(
  {
    sporeId: Hash,
    from: Address,
    to: Address,
  },
  ["sporeId", "from", "to"],
);
export const MeltSpore = molecule.table(
  {
    sporeId: Hash,
    from: Address,
  },
  ["sporeId", "from"],
);

/**
 * Cluster
 */
export const CreateCluster = molecule.table(
  {
    clusterId: Hash,
    to: Address,
    dataHash: Hash,
  },
  ["clusterId", "to", "dataHash"],
);
export const TransferCluster = molecule.table(
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
export const CreateClusterProxy = molecule.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "to"],
);
export const TransferClusterProxy = molecule.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    from: Address,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "from", "to"],
);
export const MeltClusterProxy = molecule.table(
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
export const CreateClusterAgent = molecule.table(
  {
    clusterId: Hash,
    clusterProxyId: Hash,
    to: Address,
  },
  ["clusterId", "clusterProxyId", "to"],
);
export const TransferClusterAgent = molecule.table(
  {
    clusterId: Hash,
    from: Address,
    to: Address,
  },
  ["clusterId", "from", "to"],
);
export const MeltClusterAgent = molecule.table(
  {
    clusterId: Hash,
    from: Address,
  },
  ["clusterId", "from"],
);

/**
 * Spore ScriptInfo Actions
 */
export const SporeAction = molecule.union(
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
