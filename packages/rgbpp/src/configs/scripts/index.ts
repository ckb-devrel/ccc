import { ccc } from "@ckb-ccc/core";

import { PredefinedNetwork } from "../../types/network.js";
import { signetCellDeps, signetScripts } from "./signet.js";

/**
 * Script configurations for Bitcoin Signet network only.
 * For Testnet3 and Mainnet, use ccc.Client.getKnownScript() instead.
 */
export const signetScriptConfig = {
  scripts: signetScripts,
  cellDeps: signetCellDeps,
};

export const deadLock = ccc.Script.from({
  codeHash:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  hashType: "data",
  args: "0x",
});

export const DEFAULT_DUST_LIMIT = 546;

export const DEFAULT_FEE_RATE = 1;
