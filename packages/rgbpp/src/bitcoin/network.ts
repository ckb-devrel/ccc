import * as bitcoin from "bitcoinjs-lib";

import {
  BTC_DEFAULT_DUST_LIMIT,
  BTC_DEFAULT_FEE_RATE,
} from "./transaction/index.js";

export enum NetworkType {
  MAINNET,
  TESTNET,
  REGTEST, // deprecated
}

export enum PredefinedNetwork {
  BitcoinTestnet3 = "BitcoinTestnet3",
  BitcoinMainnet = "BitcoinMainnet",
}

export interface NetworkConfig {
  name: string;
  isMainnet: boolean;
  btcDustLimit: number;
  btcFeeRate: number;
}

export interface NetworkConfigOverrides {
  btcDustLimit?: number;
  btcFeeRate?: number;
}

export type Network = PredefinedNetwork | string;

export function toBtcNetwork(network: string): bitcoin.Network {
  return network === (PredefinedNetwork.BitcoinMainnet as string)
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}

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
        btcDustLimit: overrides?.btcDustLimit || BTC_DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || BTC_DEFAULT_FEE_RATE,
      };
      break;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    case PredefinedNetwork.BitcoinMainnet:
      config = {
        name: PredefinedNetwork.BitcoinMainnet,
        isMainnet: true,
        btcDustLimit: overrides?.btcDustLimit || BTC_DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || BTC_DEFAULT_FEE_RATE,
      };
      break;
    default:
      config = {
        name: network,
        isMainnet: false,
        btcDustLimit: overrides?.btcDustLimit || BTC_DEFAULT_DUST_LIMIT,
        btcFeeRate: overrides?.btcFeeRate || BTC_DEFAULT_FEE_RATE,
      };
      break;
  }

  return overrides ? mergeNetworkConfigs(config, overrides) : config;
}

function mergeNetworkConfigs(
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
