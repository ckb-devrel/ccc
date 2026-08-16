"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

type TimeLockCell = { cell: ccc.Cell; lock: ccc.Script };

function buildTimeLockArgs(
  requiredScriptHash: ccc.HexLike,
  lockedUntil: ccc.NumLike,
) {
  return ccc.bytesConcat(requiredScriptHash, ccc.numToBytes(lockedUntil, 8));
}

async function buildTimeLockedTransfer(
  signer: ccc.Signer,
  destination: string,
  amount: string,
  blocks: string,
) {
  const to = await ccc.Address.fromString(destination, signer.client);
  const lockedUntil = ccc.Since.from({
    relative: "absolute",
    metric: "blockNumber",
    value: (await signer.client.getTip()) + ccc.numFrom(blocks),
  });
  const lock = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.TimeLock,
    buildTimeLockArgs(to.script.hash(), lockedUntil.toNum()),
  );
  const tx = ccc.Transaction.from({ outputs: [{ lock }] });
  if (tx.getOutputsCapacity() > ccc.fixedPointFrom(amount)) {
    throw new Error("Amount is below the minimum cell capacity");
  }
  tx.outputs[0].capacity = ccc.fixedPointFrom(amount);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);
  return tx;
}

async function findTimeLockCells(signer: ccc.Signer) {
  const cells: TimeLockCell[] = [];
  for await (const { script: ownerLock } of await signer.getAddressObjs()) {
    const prefix = await ccc.Script.fromKnownScript(
      signer.client,
      ccc.KnownScript.TimeLock,
      ownerLock.hash(),
    );
    for await (const cell of signer.client.findCells({
      script: prefix,
      scriptType: "lock",
      scriptSearchMode: "prefix",
    })) {
      cells.push({ cell, lock: ownerLock });
    }
  }
  return cells;
}

async function buildClaim(signer: ccc.Signer, { cell, lock }: TimeLockCell) {
  const to = await signer.getRecommendedAddressObj();
  const iterator = signer.client.findCells(
    {
      script: lock,
      scriptSearchMode: "exact",
      scriptType: "lock",
      filter: { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] },
      withData: true,
    },
    undefined,
    1,
  );
  const { value: ownerCell, done } = await iterator.next();
  if (done || !ownerCell) throw new Error("An owner cell is required to claim");
  const tx = ccc.Transaction.from({
    inputs: [
      ownerCell,
      {
        previousOutput: cell.outPoint,
        since: ccc.numFromBytes(
          ccc.bytesFrom(cell.cellOutput.lock.args).slice(32, 40),
        ),
        cellOutput: cell.cellOutput,
        outputData: cell.outputData,
      },
    ],
    outputs: [{ lock: to.script }],
  });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.TimeLock);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeChangeToOutput(signer, 0);
  return tx;
}

export function TimeLockedTransferModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [blocks, setBlocks] = useState("");
  const [cells, setCells] = useState<TimeLockCell[]>([]);
  const [selectedCell, setSelectedCell] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    findTimeLockCells(signer)
      .then((next) => {
        if (!cancelled) {
          setCells(next);
          setSelectedCell(cellKey(next[0]?.cell));
        }
      })
      .catch(
        (cause) =>
          !cancelled &&
          reportModuleError(cause, show, log, "Unable to load time-lock cells"),
      );
    return () => {
      cancelled = true;
    };
  }, [log, show, signer]);

  const transmit = async (mode: "claim" | "lock") => {
    if (!signer) return;
    setBusy(true);
    try {
      const selected = cells.find(({ cell }) => cellKey(cell) === selectedCell);
      const tx =
        mode === "lock"
          ? await buildTimeLockedTransfer(signer, destination, amount, blocks)
          : selected
            ? await buildClaim(signer, selected)
            : undefined;
      if (!tx) throw new Error("Select a time-lock cell to claim");
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `Time-lock ${mode} sent`);
      log(`Transaction sent: ${txHash}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(
        client,
        show,
        txHash,
        `Time-lock ${mode} committed`,
        true,
      );
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, `Time-lock ${mode} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Destination</span>
          <input
            value={destination}
            onChange={(event) => setDestination(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Amount / CKB</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Lock for blocks</span>
          <input
            value={blocks}
            inputMode="numeric"
            onChange={(event) => setBlocks(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Claimable time-lock cell</span>
          <select
            value={selectedCell}
            onChange={(event) => setSelectedCell(event.currentTarget.value)}
          >
            <option value="">
              {cells.length ? "Select a cell" : "No time-lock cells found"}
            </option>
            {cells.map(({ cell }) => (
              <option value={cellKey(cell)} key={cellKey(cell)}>
                {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB ·{" "}
                {cell.outPoint.txHash.slice(0, 12)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          disabled={busy || !selectedCell}
          onClick={() => transmit("claim")}
        >
          Claim
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || !destination || !amount || !blocks}
          onClick={() => transmit("lock")}
        >
          {busy ? "Processing…" : "Lock capacity"}
        </button>
      </div>
    </div>
  );
}

function cellKey(cell?: ccc.Cell) {
  return cell ? ccc.hexFrom(cell.outPoint.toBytes()) : "";
}
