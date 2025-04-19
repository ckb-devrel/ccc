import { ccc } from "@ckb-ccc/shell";

import { PredefinedNetwork } from "../../types/network.js";
import { signetCellDeps, signetScripts } from "./signet.js";
import { testnet3CellDeps, testnet3Scripts } from "./testnet3.js";

export const predefinedScripts = {
  [PredefinedNetwork.BitcoinSignet]: signetScripts,
  [PredefinedNetwork.BitcoinTestnet3]: testnet3Scripts,
};

export const predefinedCellDeps = {
  [PredefinedNetwork.BitcoinSignet]: signetCellDeps,
  [PredefinedNetwork.BitcoinTestnet3]: testnet3CellDeps,
};

export const deadLock = ccc.Script.from({
  codeHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  hashType: "data",
  args: "0x",
});
