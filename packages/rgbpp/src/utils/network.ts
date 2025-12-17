import { ccc } from "@ckb-ccc/core";

import {
  DEFAULT_DUST_LIMIT,
  DEFAULT_FEE_RATE,
  signetScriptConfig,
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
    case PredefinedNetwork.BitcoinTestnet3:
      config = {
        name: PredefinedNetwork.BitcoinTestnet3,
        isMainnet: false,
        btcDustLimit: overrides?.btcDustLimit || DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || DEFAULT_FEE_RATE,
      };
      break;
    case PredefinedNetwork.BitcoinSignet:
      config = {
        name: PredefinedNetwork.BitcoinSignet,
        isMainnet: false,
        btcDustLimit: overrides?.btcDustLimit || DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || DEFAULT_FEE_RATE,
        signetConfig: signetScriptConfig,
      };
      break;
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
        signetConfig: overrides?.signetConfig, // Allow custom config for other networks if needed
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
    signetConfig: overrides?.signetConfig || base.signetConfig,
  };
}

export function isMainnet(network: Network): boolean {
  return network === PredefinedNetwork.BitcoinMainnet;
}
