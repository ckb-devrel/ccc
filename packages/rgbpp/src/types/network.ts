import { CellDepSet, ScriptSet } from "./script.js";

export enum PredefinedNetwork {
  BitcoinTestnet3 = "BitcoinTestnet3",
  BitcoinSignet = "BitcoinSignet",

  BitcoinMainnet = "BitcoinMainnet",

  DogecoinMainnet = "DogecoinMainnet",
  DogecoinTestnet = "DogecoinTestnet",
}

export interface NetworkConfig {
  name: string;
  isMainnet: boolean;

  scripts: ScriptSet;
  cellDeps: CellDepSet;
}

export interface NetworkConfigOverrides {
  scripts?: Partial<ScriptSet>;
  cellDeps?: Partial<CellDepSet>;
}

export type Network = PredefinedNetwork | string;
