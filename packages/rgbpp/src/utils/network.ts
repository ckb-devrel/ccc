import {
  predefinedCellDeps,
  predefinedScripts,
} from "../configs/scripts/index.js";

import {
  Network,
  NetworkConfig,
  NetworkConfigOverrides,
  PredefinedNetwork,
} from "../types/network.js";
import { CellDepSet, ScriptSet } from "../types/script.js";

export function buildNetworkConfig(
  network: Network,
  overrides?: NetworkConfigOverrides,
): NetworkConfig {
  let config: NetworkConfig;

  switch (network) {
    case PredefinedNetwork.BitcoinTestnet3:
      config = {
        name: PredefinedNetwork.BitcoinTestnet3,
        isMainnet: false,
        scripts: predefinedScripts[PredefinedNetwork.BitcoinTestnet3],
        cellDeps: predefinedCellDeps[PredefinedNetwork.BitcoinTestnet3],
      };
      break;
    case PredefinedNetwork.BitcoinSignet:
      config = {
        name: PredefinedNetwork.BitcoinSignet,
        isMainnet: false,
        scripts: predefinedScripts[PredefinedNetwork.BitcoinSignet],
        cellDeps: predefinedCellDeps[PredefinedNetwork.BitcoinSignet],
      };
      break;
    // TODO: if not in PredefinedNetwork, predefinedScripts and predefinedCellDeps must be provided
    default:
      throw new Error(`Unsupported predefined network: ${network}`);
  }

  return overrides ? mergeConfigs(config, overrides) : config;
}

function mergeConfigs(
  base: NetworkConfig,
  overrides: NetworkConfigOverrides,
): NetworkConfig {
  return {
    name: base.name,
    isMainnet: base.isMainnet,
    scripts: Object.assign(
      {},
      base.scripts,
      overrides.scripts || {},
    ) as ScriptSet,
    cellDeps: Object.assign(
      {},
      base.cellDeps,
      overrides.cellDeps || {},
    ) as CellDepSet,
  };
}

export function isMainnet(network: Network): boolean {
  return (
    network === PredefinedNetwork.BitcoinMainnet ||
    network === PredefinedNetwork.DogecoinMainnet
  );
}
