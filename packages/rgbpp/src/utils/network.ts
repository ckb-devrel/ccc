import {
  DEFAULT_DUST_LIMIT,
  DEFAULT_FEE_RATE,
} from "../configs/scripts/index.js";

import {
  Network,
  NetworkConfig,
  NetworkConfigOverrides,
  PredefinedNetwork,
} from "../types/network.js";

export function buildNetworkConfig(
  network: Network,
  overrides?: NetworkConfigOverrides,
): NetworkConfig {
  let config: NetworkConfig;

  switch (network) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    case PredefinedNetwork.BitcoinTestnet3:
      config = {
        name: PredefinedNetwork.BitcoinTestnet3,
        isMainnet: false,
        btcDustLimit: overrides?.btcDustLimit || DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || DEFAULT_FEE_RATE,
      };
      break;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    case PredefinedNetwork.BitcoinMainnet:
      config = {
        name: PredefinedNetwork.BitcoinMainnet,
        isMainnet: true,
        btcDustLimit: overrides?.btcDustLimit || DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || DEFAULT_FEE_RATE,
      };
      break;
    default:
      config = {
        name: network,
        isMainnet: false,
        btcDustLimit: overrides?.btcDustLimit || DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || DEFAULT_FEE_RATE,
      };
      break;
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
    btcDustLimit: overrides?.btcDustLimit || base.btcDustLimit,
    btcFeeRate: overrides?.btcFeeRate || base.btcFeeRate,
  };
}

export function isMainnet(network: Network): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
  return network === PredefinedNetwork.BitcoinMainnet;
}
