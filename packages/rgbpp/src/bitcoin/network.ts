import * as bitcoin from "bitcoinjs-lib";

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

export enum NetworkType {
  MAINNET,
  TESTNET,
  REGTEST, // deprecated
}

export function toBtcNetwork(network: string): bitcoin.Network {
  return network === (PredefinedNetwork.BitcoinMainnet as string)
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;
}
