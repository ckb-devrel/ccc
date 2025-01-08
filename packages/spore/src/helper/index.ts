import { ccc } from "@ckb-ccc/core";
import { SporeScriptInfo, SporeScriptInfoLike } from "../predefined/index.js";

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

    const cell = await client.findSingletonCellByType(
      {
        ...scriptInfo,
        args,
      },
      true,
    );

    if (cell) {
      return {
        cell,
        scriptInfo: SporeScriptInfo.from(scriptInfo),
      };
    }
  }
}
