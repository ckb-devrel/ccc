import * as cccLib from "@ckb-ccc/ccc";
import * as cccAdvancedLib from "@ckb-ccc/ccc/advanced";
import { ccc } from "@ckb-ccc/connector-react";
import * as rgbppLib from "@ckb-ccc/rgbpp";
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
    const lib = {
      "@ckb-ccc/core": cccLib,
      "@ckb-ccc/core/advanced": cccAdvancedLib,
      "@ckb-ccc/ccc": cccLib,
      "@ckb-ccc/ccc/advanced": cccAdvancedLib,
      "@nervina-labs/dob-render": dobRenderLib,
      "@ckb-ccc/rgbpp": rgbppLib,
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
        initRgbppEnv: async (
          signer: ccc.SignerBtc,
        ): Promise<{
          btcRgbppSigner: rgbppLib.RgbppBtcWallet;
          ckbRgbppUnlockSinger: rgbppLib.CkbRgbppUnlockSinger;
          rgbppUdtClient: rgbppLib.RgbppUdtClient;
        }> => {
          const networkConfig = rgbppLib.buildNetworkConfig(
            rgbppLib.PredefinedNetwork.BitcoinTestnet3,
            // TODO: update updated RGB++ cell deps in ccc
            {
              cellDeps: {
                [rgbppLib.PredefinedScriptName.RgbppLock]: ccc.CellDep.from({
                  outPoint: {
                    txHash:
                      "0x0d1567da0979f78b297d5311442669fbd1bd853c8be324c5ab6da41e7a1ed6e5",
                    index: "0x0",
                  },
                  depType: "code",
                }),
                [rgbppLib.PredefinedScriptName.BtcTimeLock]: ccc.CellDep.from({
                  outPoint: {
                    txHash:
                      "0x8fb747ff0416a43e135c583b028f98c7b81d3770551b196eb7ba1062dd9acc94",
                    index: "0x0",
                  },
                  depType: "code",
                }),
              },
            },
          );

          const btcRgbppSigner = await rgbppLib.createBrowserRgbppBtcWallet(
            signer,
            networkConfig,
            {
              url: "https://api-testnet.rgbpp.com",
              // TODO: remove the following 2 configs
              token:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnRlZ3JhdGlvbi10ZXN0IiwiYXVkIjoibG9jYWxob3N0IiwianRpIjoiM2VjMTY2OTYtOTE4Yy00NWYzLTkzZjAtNjQ3ZGNlMTc1MjlkIiwiaWF0IjoxNzQ4NTUwODc5fQ.0SA2UHjluxsHZxHw4EYJxVUIuxuVflVaRrkucocg6Og",
              origin: "localhost",
            },
          );
          if (!btcRgbppSigner) {
            throw new Error("Failed to create browser RGBPP BTC singer");
          }

          const rgbppUdtClient = new rgbppLib.RgbppUdtClient(
            networkConfig,
            signer.client,
          );
          const ckbRgbppUnlockSinger = new rgbppLib.CkbRgbppUnlockSinger(
            signer.client,
            await btcRgbppSigner.getAddress(),
            btcRgbppSigner,
            btcRgbppSigner,
            rgbppUdtClient.getRgbppScriptInfos(),
          );

          return {
            btcRgbppSigner,
            ckbRgbppUnlockSinger,
            rgbppUdtClient,
          };
        },
        // TODO: prepare ckb issuance cells, move to rgbppUdtClient
        prepareRgbppUdtIssuanceCells: async (
          signer: ccc.Signer,
          utxoSeal: rgbppLib.UtxoSeal,
          rgbppUdtClient: rgbppLib.RgbppUdtClient,
        ): Promise<ccc.Cell[]> => {
          const rgbppLockScript = rgbppUdtClient.buildRgbppLockScript(utxoSeal);

          const rgbppCellsGen =
            await signer.client.findCellsByLock(rgbppLockScript);
          const rgbppCells: ccc.Cell[] = [];
          for await (const cell of rgbppCellsGen) {
            rgbppCells.push(cell);
          }

          if (rgbppCells.length !== 0) {
            console.log("Using existing RGB++ cell");
            return rgbppCells;
          }

          console.log("RGB++ cell not found, creating a new one");
          const tx = ccc.Transaction.default();

          // If additional capacity is required when used as an input in a transaction, it can always be supplemented in `completeInputsByCapacity`.
          tx.addOutput({
            lock: rgbppLockScript,
          });

          await tx.completeInputsByCapacity(signer);
          await tx.completeFeeBy(signer);
          const txHash = await signer.sendTransaction(tx);
          await signer.client.waitTransaction(txHash);
          console.log(`RGB++ cell created, txHash: ${txHash}`);

          const cell = await signer.client.getCellLive({
            txHash,
            index: 0,
          });
          if (!cell) {
            throw new Error("Cell not found");
          }

          return [cell];
        },
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
