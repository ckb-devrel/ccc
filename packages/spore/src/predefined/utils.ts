import { ccc } from "@ckb-ccc/core";
import {
  SCRIPTS_CLUSTER_MAINNET,
  SCRIPTS_CLUSTER_TESTNET,
  SCRIPTS_MUTANT_MAINNET,
  SCRIPTS_MUTANT_TESTNET,
  SCRIPTS_SPORE_MAINNET,
  SCRIPTS_SPORE_TESTNET,
} from "./advanced.js";
import {
  SPORE_VERSION_DEFAULT,
  SporeScriptInfo,
  SporeVersion,
} from "./types.js";

export function getSporeScriptInfos(client: ccc.Client) {
  return client.addressPrefix === "ckb"
    ? SCRIPTS_SPORE_MAINNET
    : SCRIPTS_SPORE_TESTNET;
}

export function getClusterScriptInfos(client: ccc.Client) {
  return client.addressPrefix === "ckb"
    ? SCRIPTS_CLUSTER_MAINNET
    : SCRIPTS_CLUSTER_TESTNET;
}

export function getSporeScriptInfo(
  client: ccc.Client,
  version?: SporeVersion,
): SporeScriptInfo {
  const scriptInfo =
    getSporeScriptInfos(client)[version ?? SPORE_VERSION_DEFAULT];

  if (!scriptInfo) {
    throw new Error(
      `Spore script info not found of for version ${version} on ${client.addressPrefix}`,
    );
  }

  return SporeScriptInfo.from(scriptInfo);
}

export function getClusterScriptInfo(
  client: ccc.Client,
  version?: SporeVersion,
): SporeScriptInfo {
  const scriptInfo =
    getClusterScriptInfos(client)[version ?? SPORE_VERSION_DEFAULT];

  if (!scriptInfo) {
    throw new Error(
      `Cluster script info not found of for version ${version} on ${client.addressPrefix}`,
    );
  }

  return SporeScriptInfo.from(scriptInfo);
}

export function getMutantScriptInfos(client: ccc.Client) {
  return client.addressPrefix === "ckb"
    ? SCRIPTS_MUTANT_MAINNET
    : SCRIPTS_MUTANT_TESTNET;
}

/**
 * Get the Mutant extension script info of the given version.
 *
 * Spore v3 entries (native Rust Mutants) resolve only after the
 * corresponding spore-contract deployment is published here; until then,
 * pass a custom `SporeScriptInfoLike` where a Mutant script is required.
 */
export function getMutantScriptInfo(
  client: ccc.Client,
  version?: SporeVersion,
): SporeScriptInfo {
  const scriptInfo =
    getMutantScriptInfos(client)[version ?? SPORE_VERSION_DEFAULT];

  if (!scriptInfo) {
    throw new Error(
      `Mutant script info not found of for version ${version ?? SPORE_VERSION_DEFAULT} on ${client.addressPrefix}`,
    );
  }

  return SporeScriptInfo.from(scriptInfo);
}
