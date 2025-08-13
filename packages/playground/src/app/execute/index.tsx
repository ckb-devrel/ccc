import * as cccLib from "@ckb-ccc/ccc";
import * as cccAdvancedLib from "@ckb-ccc/ccc/advanced";
import { ccc } from "@ckb-ccc/connector-react";
import * as dobRenderLib from "@nervina-labs/dob-render";
import * as React from "react";
import ts from "typescript";
import { formatTimestamp } from "../utils";
import { vlqDecode } from "./vlq";

function findSourcePos(
  sourceMap: string | undefined,
  row: number,
  col: number,
): [number, number, number, number] | undefined {
  if (!sourceMap) {
    return;
  }
  const lines = JSON.parse(sourceMap).mappings.split(";") as string[];

  let sRow = 0;
  let sCol = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "") {
      continue;
    }
    let nowCol = 0;
    for (const map of line.split(",").map((c: string) => vlqDecode(c))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [colInc, _, sRowInc, sColInc] = map;
      nowCol += colInc;
      if (i === row && nowCol >= col) {
        return [sRow, sRow + sRowInc, sCol, sCol + sColInc];
      }

      sRow += sRowInc;
      sCol += sColInc;
    }
  }
}

export async function execute(
  source: string,
  onUpdate: (
    pos: [number, number, number, number] | undefined,
  ) => Promise<void>,
  signer: ccc.Signer,
  log: (level: "error" | "info", title: string, msgs: unknown[]) => void,
) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { sourceMap: true, jsx: ts.JsxEmit.React },
  });

  const exports = {};
  const require = (path: string) => {
    const lib = {
      "@ckb-ccc/core": cccLib,
      "@ckb-ccc/core/advanced": cccAdvancedLib,
      "@ckb-ccc/ccc": cccLib,
      "@ckb-ccc/ccc/advanced": cccAdvancedLib,
      "@nervina-labs/dob-render": dobRenderLib,
      "@ckb-ccc/playground": {
        render: async (...msgs: unknown[]) => {
          log("info", formatTimestamp(Date.now()), msgs);

          const stack = new Error().stack;
          if (!stack) {
            return;
          }
          const match = stack
            .split("\n")[2]
            ?.match("<anonymous>:([0-9]*):([0-9]*)\\)");
          if (!match) {
            return;
          }
          try {
            await onUpdate(
              findSourcePos(
                compiled.sourceMapText,
                Number(match[1]) - 4,
                Number(match[2]) - 2,
              ),
            );
          } catch (err) {
            if (err !== "ABORTED") {
              throw err;
            }
          }
        },
        signer,
        client: signer.client,
      },
    }[path];

    if (!lib) {
      return;
    }

    return lib;
  };

  try {
    await Function(
      "exports",
      "require",
      "React",
      "console",
      `return (async () => {\n${compiled.outputText}\n})();`,
    )(exports, require, React, {
      log: (...msgs: unknown[]) =>
        log("info", formatTimestamp(Date.now()), msgs),
      error: (...msgs: unknown[]) =>
        log("error", formatTimestamp(Date.now()), msgs),
    });
  } finally {
    await onUpdate(undefined);
  }
  return;
}
