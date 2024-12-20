import { ccc } from "@ckb-ccc/connector-react";
import * as cccLib from "@ckb-ccc/ccc";
import { ReactNode } from "react";
import ts from "typescript";
import { vlqDecode } from "./vlq";

function findSourcePos(
  sourceMap: string | undefined,
  row: number,
  col: number
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
    tx: ccc.Transaction | undefined
  ) => Promise<void>,
  signer: ccc.Signer,
  log: (level: "error" | "info", title: string, msgs: ReactNode[]) => void
) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { sourceMap: true },
  });

  const exports = {};
  const require = (path: string) => {
    const lib = {
      "@ckb-ccc/core": cccLib,
      "@ckb-ccc/ccc": cccLib,
      "@ckb-ccc/playground": {
        render: async (tx: ccc.Transaction | unknown) => {
          if (!(tx instanceof ccc.Transaction)) {
            return;
          }
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
                Number(match[2]) - 2
              ),
              tx
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
      "console",
      `return (async () => {\n${compiled.outputText}\n})();`
    )(exports, require, {
      log: (...msgs: unknown[]) =>
        log(
          "info",
          "",
          msgs.map((m) =>
            JSON.stringify(m, (_, value) => {
              if (typeof value === "bigint") {
                return value.toString();
              }
              return value;
            })
          )
        ),
      error: (...msgs: unknown[]) =>
        log(
          "error",
          "",
          msgs.map((m) =>
            JSON.stringify(m, (_, value) => {
              if (typeof value === "bigint") {
                return value.toString();
              }
              return value;
            })
          )
        ),
    });
  } finally {
    await onUpdate(undefined, undefined);
  }
  return;
}
