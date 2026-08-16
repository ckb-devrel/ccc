"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleItem, ModuleItemList } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import { reportModuleError, showTransaction } from "./module-helpers";
import styles from "./nervos-dao-module.module.css";

async function* findDaoCells(signer: ccc.Signer) {
  const dao = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.NervosDao,
    "0x",
  );
  for await (const cell of signer.findCells(
    { script: dao, scriptLenRange: [33, 34], outputDataLenRange: [8, 9] },
    true,
  )) {
    yield cell;
  }
}

type DaoPosition = {
  cell: ccc.Cell;
  profit: ccc.Num;
  unlockIn: ccc.FixedPoint;
};

function parseEpoch(epoch: ccc.Epoch): ccc.FixedPoint {
  return (
    ccc.fixedPointFrom(epoch[0].toString()) +
    (ccc.fixedPointFrom(epoch[1].toString()) * ccc.fixedPointFrom(1)) /
      ccc.fixedPointFrom(epoch[2].toString())
  );
}

function isDaoDeposit(cell: ccc.Cell) {
  return cell.outputData === "0x0000000000000000";
}

async function prepareDaoPositions(cells: ccc.Cell[], signer: ccc.Signer) {
  const tip = await signer.client.getTipHeader();

  return Promise.all(
    cells.map(async (cell): Promise<DaoPosition> => {
      const { depositHeader, withdrawHeader } = await cell.getNervosDaoInfo(
        signer.client,
      );
      if (!depositHeader) {
        throw new Error("DAO deposit header not found");
      }

      const referenceHeader = withdrawHeader ?? tip;
      return {
        cell,
        profit: ccc.calcDaoProfit(
          cell.capacityFree,
          depositHeader,
          referenceHeader,
        ),
        unlockIn:
          parseEpoch(ccc.calcDaoClaimEpoch(depositHeader, referenceHeader)) -
          parseEpoch(tip.epoch),
      };
    }),
  );
}

async function buildDaoDeposit(signer: ccc.Signer, amount?: string) {
  const { script: lock } = await signer.getRecommendedAddressObj();
  const tx = ccc.Transaction.from({
    outputs: [
      {
        lock,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.NervosDao,
          "0x",
        ),
      },
    ],
    outputsData: ["00".repeat(8)],
  });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.NervosDao);
  if (amount === undefined) {
    await tx.completeInputsAll(signer);
    await tx.completeFeeChangeToOutput(signer, 0);
  } else {
    if (tx.outputs[0].capacity > ccc.fixedPointFrom(amount)) {
      throw new Error(
        `Minimum deposit is ${ccc.fixedPointToString(tx.outputs[0].capacity)} CKB`,
      );
    }
    tx.outputs[0].capacity = ccc.fixedPointFrom(amount);
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
  }
  return tx;
}

async function buildDaoAction(signer: ccc.Signer, dao: ccc.Cell) {
  const { depositHeader, withdrawHeader } = await dao.getNervosDaoInfo(
    signer.client,
  );
  if (!depositHeader) throw new Error("DAO deposit header not found");
  if (isDaoDeposit(dao)) {
    const tx = ccc.Transaction.from({
      headerDeps: [depositHeader.hash],
      inputs: [{ previousOutput: dao.outPoint }],
      outputs: [dao.cellOutput],
      outputsData: [ccc.numLeToBytes(depositHeader.number, 8)],
    });
    await tx.addCellDepsOfKnownScripts(
      signer.client,
      ccc.KnownScript.NervosDao,
    );
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
    return tx;
  }

  if (!withdrawHeader) throw new Error("DAO withdraw header not found");
  const tx = ccc.Transaction.from({
    headerDeps: [withdrawHeader.hash, depositHeader.hash],
    inputs: [
      {
        previousOutput: dao.outPoint,
        since: {
          relative: "absolute",
          metric: "epoch",
          value: ccc.epochToHex(
            ccc.calcDaoClaimEpoch(depositHeader, withdrawHeader),
          ),
        },
      },
    ],
    outputs: [{ lock: (await signer.getRecommendedAddressObj()).script }],
    witnesses: [
      ccc.WitnessArgs.from({ inputType: ccc.numLeToBytes(1, 8) }).toBytes(),
    ],
  });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.NervosDao);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeChangeToOutput(signer, 0);
  return tx;
}

// -----------------------------------------------------------------------------

export function NervosDaoModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [amount, setAmount] = useState("");
  const [busyAction, setBusyAction] = useState<string>();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const {
    hasMore,
    items: positions,
    loadMore,
    loading,
  } = usePagedModuleItems({
    source: signer,
    revision: refreshNonce,
    iterate: findDaoCells,
    preparePage: prepareDaoPositions,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load DAO cells"),
  });

  const maximum = async () => {
    if (!signer) return;
    try {
      const tx = await buildDaoDeposit(signer);
      const value = ccc.fixedPointToString(tx.outputs[0].capacity);
      setAmount(value);
      show({
        label: "MAXIMUM",
        tone: "success",
        content: (
          <CopyableReadoutValue
            value={value}
            onError={(cause) =>
              reportModuleError(cause, show, log, "Unable to copy maximum")
            }
          >
            {`${value} CKB`}
          </CopyableReadoutValue>
        ),
      });
      log(`Maximum DAO deposit: ${value} CKB`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Unable to calculate DAO maximum");
    }
  };

  const submit = async (mode: "deposit" | "progress", cell?: ccc.Cell) => {
    if (!signer) return;
    const actionKey = mode === "deposit" ? mode : cellKey(cell);
    setBusyAction(actionKey);
    try {
      const tx =
        mode === "deposit"
          ? await buildDaoDeposit(signer, amount)
          : cell
            ? await buildDaoAction(signer, cell)
            : undefined;
      if (!tx) throw new Error("Select a DAO cell");
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `DAO ${mode} sent`);
      log(`Transaction sent: ${txHash}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, `DAO ${mode} committed`, true);
      log(`Transaction committed: ${txHash}`, "success");
      setRefreshNonce((value) => value + 1);
    } catch (cause) {
      reportModuleError(cause, show, log, `DAO ${mode} failed`);
    } finally {
      setBusyAction(undefined);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Deposit amount / CKB</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <div className="module-actions module-field-wide">
          <button
            type="button"
            disabled={!signer || busyAction !== undefined}
            onClick={maximum}
          >
            Max
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={!signer || !amount || busyAction !== undefined}
            onClick={() => submit("deposit")}
          >
            {busyAction === "deposit" ? "Processing…" : "Deposit"}
          </button>
        </div>
        <ModuleItemList
          label="DAO positions"
          count={positions.length}
          emptyText="No DAO positions found"
          expandedRowsOnMobile
          hasMore={hasMore}
          loadingMore={loading}
          onLoadMore={loadMore}
        >
          {positions.map(({ cell, profit, unlockIn }) => {
            const key = cellKey(cell);
            const action = isDaoDeposit(cell) ? "Redeem" : "Withdraw";
            return (
              <ModuleItem
                className={styles["dao-position"]}
                disabled={busyAction !== undefined}
                title={key}
                key={key}
                onClick={() => submit("progress", cell)}
              >
                <span className={styles["dao-position-value"]}>
                  <strong>
                    {formatCkb(cell.cellOutput.capacity, "0.01")} CKB
                  </strong>
                  <small>+{formatCkb(profit, "0.0001")} CKB</small>
                </span>
                <span className={styles["dao-position-unlock"]}>
                  <strong>{formatUnlockEpochs(unlockIn)} Epochs</strong>
                  <small>until unlock</small>
                </span>
                <span className={styles["dao-position-action"]}>
                  <strong>{busyAction === key ? "Processing…" : action}</strong>
                </span>
              </ModuleItem>
            );
          })}
        </ModuleItemList>
      </div>
    </div>
  );
}

function cellKey(cell?: ccc.Cell) {
  return cell ? ccc.hexFrom(cell.outPoint.toBytes()) : "";
}

function formatCkb(value: ccc.Num, precision: string) {
  const step = ccc.fixedPointFrom(precision);
  return ccc.fixedPointToString((value / step) * step);
}

function formatUnlockEpochs(value: ccc.FixedPoint) {
  if (value <= 0) {
    return "0";
  }
  const step = ccc.fixedPointFrom("0.001");
  return ccc.fixedPointToString((value / step) * step);
}
