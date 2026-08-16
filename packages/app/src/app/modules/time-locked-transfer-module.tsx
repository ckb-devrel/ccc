"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { ModuleItem, ModuleItemList } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
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

async function* findTimeLockCells(signer: ccc.Signer) {
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
      yield { cell, lock: ownerLock };
    }
  }
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
  const [tip, setTip] = useState<ccc.Num>();
  const [busyAction, setBusyAction] = useState<string>();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const {
    hasMore,
    items: cells,
    loadMore,
    loading,
  } = usePagedModuleItems<ccc.Signer, TimeLockCell>({
    source: signer,
    revision: refreshNonce,
    iterate: findTimeLockCells,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load time-lock cells"),
  });

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    signer.client
      .getTip()
      .then((nextTip) => {
        if (!cancelled) setTip(nextTip);
      })
      .catch(
        (cause) =>
          !cancelled &&
          reportModuleError(cause, show, log, "Unable to load chain tip"),
      );
    return () => {
      cancelled = true;
    };
  }, [log, refreshNonce, show, signer]);

  const transmit = async (mode: "claim" | "lock", target?: TimeLockCell) => {
    if (!signer) return;
    const actionKey = mode === "lock" ? mode : cellKey(target?.cell);
    setBusyAction(actionKey);
    try {
      const tx =
        mode === "lock"
          ? await buildTimeLockedTransfer(signer, destination, amount, blocks)
          : target
            ? await buildClaim(signer, target)
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
      setRefreshNonce((value) => value + 1);
    } catch (cause) {
      reportModuleError(cause, show, log, `Time-lock ${mode} failed`);
    } finally {
      setBusyAction(undefined);
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
        <ModuleItemList
          label="Time-lock cells"
          count={cells.length}
          emptyText="No time-lock cells found"
          hasMore={hasMore}
          loadingMore={loading}
          onLoadMore={loadMore}
        >
          {cells.map((target) => {
            const { cell } = target;
            const key = cellKey(cell);
            const since = timeLockSince(cell);
            const unlocked = tip !== undefined && since.value <= tip;
            const remaining = tip === undefined ? ccc.Zero : since.value - tip;
            return (
              <ModuleItem
                className="time-lock-cell"
                disabled={busyAction !== undefined || !unlocked}
                title={`${cell.outPoint.txHash}:${cell.outPoint.index}`}
                key={key}
                onClick={() => transmit("claim", target)}
              >
                <span className="module-selection-value">
                  <strong>
                    {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB
                  </strong>
                  <small>{shortHash(cell.outPoint.txHash)}</small>
                </span>
                <span className="time-lock-cell-status">
                  <strong>
                    {busyAction === key
                      ? "Processing…"
                      : unlocked
                        ? "Claim"
                        : `${remaining} blocks left`}
                  </strong>
                  <small>Block {since.value}</small>
                </span>
              </ModuleItem>
            );
          })}
        </ModuleItemList>
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={
            busyAction !== undefined || !destination || !amount || !blocks
          }
          onClick={() => transmit("lock")}
        >
          {busyAction === "lock" ? "Processing…" : "Lock capacity"}
        </button>
      </div>
    </div>
  );
}

function cellKey(cell?: ccc.Cell) {
  return cell ? ccc.hexFrom(cell.outPoint.toBytes()) : "";
}

function timeLockSince(cell: ccc.Cell) {
  return ccc.Since.from(
    ccc.numFromBytes(ccc.bytesFrom(cell.cellOutput.lock.args).slice(32, 40)),
  );
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}
