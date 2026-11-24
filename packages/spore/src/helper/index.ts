import { ccc } from "@ckb-ccc/core";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  SporeVersion,
  getClusterScriptInfos,
  getSporeScriptInfos,
} from "../predefined/index.js";

export async function findSingletonCellByArgs(
  client: ccc.Client,
  args: ccc.HexLike,
  scripts: (SporeScriptInfoLike | undefined)[],
): Promise<
  | {
      cell: ccc.Cell;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  for (const scriptInfo of scripts) {
    if (!scriptInfo) {
      continue;
    }

    const type = ccc.Script.from({ ...scriptInfo, args });
    const cell = await client.findSingletonCellByType(type, true);

    if (cell?.cellOutput.type?.eq(type)) {
      return {
        cell,
        scriptInfo: SporeScriptInfo.from(scriptInfo),
      };
    }
  }
}

/** Published V2 scripts require their Action even in a mixed V2/V3 transaction. */
export function shouldIncludeAction(
  client: ccc.Client,
  role: "Spore" | "Cluster",
  scriptInfo: SporeScriptInfoLike,
  withIntent?: boolean,
): boolean {
  if (withIntent !== false && scriptInfo.cobuild) {
    return true;
  }
  const legacy = (
    role === "Spore"
      ? getSporeScriptInfos(client)
      : getClusterScriptInfos(client)
  )[SporeVersion.V2];
  return (
    !!legacy?.cobuild &&
    ccc.hexFrom(scriptInfo.codeHash) === legacy.codeHash &&
    ccc.hashTypeFrom(scriptInfo.hashType) === legacy.hashType
  );
}
