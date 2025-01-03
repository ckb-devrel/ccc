import { ccc } from "@ckb-ccc/core";
import {
  SCRIPTS_CLUSTER_MAINNET,
  SCRIPTS_CLUSTER_TESTNET,
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

export function getSporeScriptVersion(
  client: ccc.Client,
  scriptLike: Omit<ccc.ScriptLike, "args">,
): SporeVersion | undefined {
  const scriptInfos = getSporeScriptInfos(client);

  for (const [version, scriptInfo] of Object.entries(scriptInfos)) {
    if (
      scriptInfo?.codeHash === scriptLike.codeHash &&
      scriptInfo?.hashType === scriptLike.hashType
    ) {
      return version as SporeVersion;
    }
  }
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

export function getClusterScriptVersion(
  client: ccc.Client,
  scriptLike: Omit<ccc.ScriptLike, "args">,
): SporeVersion | undefined {
  const scriptInfos = getClusterScriptInfos(client);

  for (const [version, scriptInfo] of Object.entries(scriptInfos)) {
    if (
      scriptInfo?.codeHash === scriptLike.codeHash &&
      scriptInfo?.hashType === scriptLike.hashType
    ) {
      return version as SporeVersion;
    }
  }
}
