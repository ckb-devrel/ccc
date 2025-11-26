import { ccc } from "@ckb-ccc/core";

import { PredefinedNetwork } from "../../types/network.js";
import { mainnetCellDeps, mainnetScripts } from "./mainnet.js";
import { signetCellDeps, signetScripts } from "./signet.js";
import { testnet3CellDeps, testnet3Scripts } from "./testnet3.js";

export const predefinedScripts = {
  [PredefinedNetwork.BitcoinSignet]: signetScripts,
  [PredefinedNetwork.BitcoinTestnet3]: testnet3Scripts,
  [PredefinedNetwork.BitcoinMainnet]: mainnetScripts,
};

export const predefinedCellDeps = {
  [PredefinedNetwork.BitcoinSignet]: signetCellDeps,
  [PredefinedNetwork.BitcoinTestnet3]: testnet3CellDeps,
  [PredefinedNetwork.BitcoinMainnet]: mainnetCellDeps,
};

export const deadLock = ccc.Script.from({
  codeHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  hashType: "data",
  args: "0x",
});

export const DEFAULT_DUST_LIMIT = 546;

export const DEFAULT_FEE_RATE = 1;
