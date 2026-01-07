import { ccc } from "@ckb-ccc/connector-react";
import * as React from "react";
import ts from "typescript";
import { formatTimestamp } from "../utils";
import { vlqDecode } from "./vlq";

const LIBS_MAP_ = new Map();
const LIBS = await Promise.all(
  (
    [
      ["@noble/curves/secp256k1"],
      ["@noble/hashes/sha2"],
      ["@ckb-ccc/ccc", "@ckb-ccc/core"],
      ["@ckb-ccc/ccc/advanced", "@ckb-ccc/core/advanced"],
      ["@nervina-labs/dob-render"],
    ] as const
  ).map(async (k) => {
    const lib = await import(k[0]);
    k.forEach((k) => LIBS_MAP_.set(k, lib));
  }),
).then(() => LIBS_MAP_);

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
    compilerOptions: {
      sourceMap: true,
      jsx: ts.JsxEmit.React,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.NodeNext,
    },
  });

  const exports = {};
  const require = (path: string) => {
    const lib = LIBS.get(path);
    if (lib) {
      return lib;
    }

    if (path === "@ckb-ccc/playground") {
      return {
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
      };
    }

    throw Error(`Unknown module ${path}`);
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
