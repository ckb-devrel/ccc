"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { BigButton } from "@/src/components/BigButton";

function ClaimButton({ cell, lock }: { cell: ccc.Cell; lock: ccc.Script }) {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Claim Time Locked");

  const { explorerTransaction } = useGetExplorerLink();

  return (
    <BigButton
      key={ccc.hexFrom(cell.outPoint.toBytes())}
      size="sm"
      iconName="Clock"
      onClick={() => {
        if (!signer) {
          return;
        }

        (async () => {
          const toAddress = await signer.getRecommendedAddressObj();
          const { value: ownerCell, done } = await signer.client
            .findCells(
              {
                script: lock,
                scriptSearchMode: "exact",
                scriptType: "lock",
                filter: {
                  scriptLenRange: [0, 1],
                  outputDataLenRange: [0, 1],
                },
                withData: true,
              },
              undefined,
              1,
            )
            .next();
          if (done) {
            error(
              "A existed owner cell from",
              ccc.Address.fromScript(lock, signer.client).toString(),
              "is required",
            );
            return;
          }

          const tx = ccc.Transaction.from({
            inputs: [
              {
                previousOutput: ownerCell.outPoint,
                cellOutput: ownerCell.cellOutput,
                outputData: ownerCell.outputData,
              },
              {
                previousOutput: cell.outPoint,
                since: ccc.numFromBytes(
                  ccc.bytesFrom(cell.cellOutput.lock.args).slice(32, 40),
                ),
                cellOutput: cell.cellOutput,
                outputData: cell.outputData,
              },
            ],
            outputs: [{ lock: toAddress.script }],
          });
          console.log(
            tx.inputs[1].since,

            ccc.bytesFrom(cell.cellOutput.lock.args).slice(32, 40),
          );
          await tx.addCellDepsOfKnownScripts(
            signer.client,
            ccc.KnownScript.TimeLock,
          );

          await tx.completeInputsByCapacity(signer);
          await tx.completeFeeChangeToOutput(signer, 0);

          const txHash = await signer.sendTransaction(tx);
          log("Transaction sent:", explorerTransaction(txHash));
          await signer.client.waitTransaction(txHash);
          log("Transaction committed:", explorerTransaction(txHash));
        })();
      }}
      className="align-center text-yellow-400"
    >
      {ccc.fixedPointToString(
        (cell.cellOutput.capacity / ccc.fixedPointFrom("0.01")) *
          ccc.fixedPointFrom("0.01"),
      )}
      <span className="-mt-2 text-xs">CKB</span>
    </BigButton>
  );
}

export default function TimeLockedTransfer() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Time Locked Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [transferTo, setTransferTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [lockedForBlocks, setLockedForBlocks] = useState<string>("");

  const [liveTimeLockCells, setLiveTimeLockCells] = useState<
    { cell: ccc.Cell; lock: ccc.Script }[]
  >([]);

  const handleTimeLockedTransfer = useCallback(async () => {
    if (!signer) {
      return;
    }

    // Verify destination addresses
    const toAddress = await ccc.Address.fromString(transferTo, signer.client);

    const tip = await signer.client.getTip();
    const lockedUntil = ccc.Since.from({
      relative: "absolute",
      metric: "blockNumber",
      value: tip + ccc.numFrom(lockedForBlocks),
    });
    const timeLockScript = await ccc.Script.fromKnownScript(
      signer.client,
      ccc.KnownScript.TimeLock,
      buildTimeLockArgs(toAddress.script.hash(), lockedUntil.toNum()),
    );

    const tx = ccc.Transaction.from({
      outputs: [{ lock: timeLockScript }],
    });

    const minimumCapacity = tx.getOutputsCapacity();
    if (minimumCapacity > ccc.fixedPointFrom(amount)) {
      error("Insufficient capacity to store data");
      return;
    }
    tx.outputs[0].capacity = ccc.fixedPointFrom(amount);

    // Complete missing parts for transaction
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);

    const txHash = await signer.sendTransaction(tx);
    log("Transaction sent:", explorerTransaction(txHash));
    await signer.client.waitTransaction(txHash);
    log("Transaction committed:", explorerTransaction(txHash));
  }, [
    signer,
    amount,
    error,
    explorerTransaction,
    lockedForBlocks,
    log,
    transferTo,
  ]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const cells = [];

      for await (const { script: lock } of await signer.getAddressObjs()) {
        for await (const cell of signer.client.findCells({
          script: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.TimeLock,
            lock.hash(),
          ),
          scriptType: "lock",
          scriptSearchMode: "prefix",
        })) {
          cells.push({ cell, lock });
        }
      }

      setLiveTimeLockCells(cells);
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Address"
        placeholder="Receiver address"
        state={[transferTo, setTransferTo]}
      />
      <TextInput
        label="Amount"
        placeholder="Amount to lock"
        state={[amount, setAmount]}
      />
      <TextInput
        label="Locked for N Blocks"
        placeholder="Can be claimed after N new blocks"
        state={[lockedForBlocks, setLockedForBlocks]}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {liveTimeLockCells.map(({ cell, lock }) => (
          <ClaimButton
            key={ccc.hexFrom(cell.outPoint.toBytes())}
            cell={cell}
            lock={lock}
          />
        ))}
      </div>
      <ButtonsPanel>
        <Button className="ml-2" onClick={handleTimeLockedTransfer}>
          Lock
        </Button>
      </ButtonsPanel>
    </div>
  );
}

function buildTimeLockArgs(
  requiredScriptHash: ccc.HexLike,
  lockedUntil: ccc.NumLike,
) {
  const lockedUntilBytes8 = ccc.numToBytes(lockedUntil, 8);
  return ccc.bytesConcat(requiredScriptHash, lockedUntilBytes8);
}
