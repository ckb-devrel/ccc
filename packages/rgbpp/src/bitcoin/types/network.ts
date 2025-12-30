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
