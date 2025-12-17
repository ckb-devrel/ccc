import { CellDepSet, ScriptSet } from "./script.js";

export enum PredefinedNetwork {
  BitcoinTestnet3 = "BitcoinTestnet3",
  BitcoinSignet = "BitcoinSignet",
  BitcoinMainnet = "BitcoinMainnet",
}

export interface NetworkConfig {
  name: string;
  isMainnet: boolean;
  btcDustLimit: number;
  btcFeeRate: number;
  
  /**
   * Signet-specific configuration (optional)
   * For Testnet3 and Mainnet, scripts are fetched from ccc.Client
   */
  signetConfig?: {
    scripts: ScriptSet;
    cellDeps: CellDepSet;
  };
}

export interface NetworkConfigOverrides {
  btcDustLimit?: number;
  btcFeeRate?: number;
  signetConfig?: {
    scripts: ScriptSet;
    cellDeps: CellDepSet;
  };
}

export type Network = PredefinedNetwork | string;
