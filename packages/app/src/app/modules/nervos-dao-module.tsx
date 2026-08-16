"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleItem, ModuleItemList } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import { reportModuleError } from "./module-helpers";
import styles from "./nervos-dao-module.module.css";

class DaoDepositTooSmallError extends Error {
  constructor(readonly minimum: ccc.Num) {
    super("DAO deposit is below the minimum cell capacity");
  }
}

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

function isDaoDeposit(cell: ccc.Cell) {
  return cell.outputData === "0x0000000000000000";
}

function addHeaderDeps(tx: ccc.Transaction, ...hashes: ccc.Hex[]) {
  hashes.forEach((hash) => {
    if (!tx.headerDeps.includes(hash)) tx.headerDeps.push(hash);
  });
}

async function addDaoDeposit(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  amount?: string,
) {
  const { script: lock } = await signer.getRecommendedAddressObj();
  const outputIndex = tx.outputs.length;
  tx.addOutput(
    {
      lock,
      type: await ccc.Script.fromKnownScript(
        signer.client,
        ccc.KnownScript.NervosDao,
        "0x",
      ),
    },
    "00".repeat(8),
  );
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.NervosDao);
  if (amount !== undefined) {
    if (tx.outputs[outputIndex].capacity > ccc.fixedPointFrom(amount)) {
      throw new DaoDepositTooSmallError(tx.outputs[outputIndex].capacity);
    }
    tx.outputs[outputIndex].capacity = ccc.fixedPointFrom(amount);
  }
  return outputIndex;
}

async function calculateMaximumDaoDeposit(signer: ccc.Signer) {
  const tx = ccc.Transaction.from({});
  const outputIndex = await addDaoDeposit(signer, tx);
  const feeRate = await signer.client.getFeeRate();
  await tx.completeInputsAll(signer);
  await tx.completeFeeChangeToOutput(signer, outputIndex, feeRate);
  return { capacity: tx.outputs[outputIndex].capacity, feeRate };
}

async function buildDaoDeposit(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  amount: string,
) {
  await addDaoDeposit(signer, tx, amount);
  return tx;
}

async function buildDaoAction(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  dao: ccc.Cell,
) {
  const { depositHeader, withdrawHeader } = await dao.getNervosDaoInfo(
    signer.client,
  );
  if (!depositHeader) throw new Error("DAO deposit header not found");
  if (isDaoDeposit(dao)) {
    addHeaderDeps(tx, depositHeader.hash);
    tx.addInput(dao);
    tx.addOutput(dao.cellOutput, ccc.numLeToBytes(depositHeader.number, 8));
    await tx.addCellDepsOfKnownScripts(
      signer.client,
      ccc.KnownScript.NervosDao,
    );
    return tx;
  }

  if (!withdrawHeader) throw new Error("DAO withdraw header not found");
  addHeaderDeps(tx, withdrawHeader.hash, depositHeader.hash);
  const inputIndex =
    tx.addInput({
      previousOutput: dao.outPoint,
      since: {
        relative: "absolute",
        metric: "epoch",
        value: ccc.epochToHex(
          ccc.calcDaoClaimEpoch(depositHeader, withdrawHeader),
        ),
      },
      cellOutput: dao.cellOutput,
      outputData: dao.outputData,
    }) - 1;
  tx.setWitnessArgs(inputIndex, { inputType: ccc.numLeToBytes(1, 8) });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.NervosDao);
  return tx;
}

// -----------------------------------------------------------------------------

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

export function NervosDaoModule({
  log,
  show,
  signer,
  submitTransaction,
}: ModuleRuntimeProps) {
  const [amount, setAmount] = useState("");
  const [maximumFeeRate, setMaximumFeeRate] = useState<ccc.Num>();
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
    setMaximumFeeRate(undefined);
    if (!signer) return;
    try {
      const result = await calculateMaximumDaoDeposit(signer);
      const value = ccc.fixedPointToString(result.capacity);
      setAmount(value);
      setMaximumFeeRate(result.feeRate);
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
      const actionName =
        mode === "deposit"
          ? "DAO deposit"
          : cell && isDaoDeposit(cell)
            ? "DAO redeem"
            : "DAO withdraw";
      await submitTransaction(
        actionName,
        (tx) => {
          if (mode === "deposit") return buildDaoDeposit(signer, tx, amount);
          if (!cell) throw new Error("Select a DAO cell");
          return buildDaoAction(signer, tx, cell);
        },
        { feeRate: mode === "deposit" ? maximumFeeRate : undefined },
      );
      setRefreshNonce((value) => value + 1);
    } catch (cause) {
      reportModuleError(
        describeDaoError(cause),
        show,
        log,
        `DAO ${mode} failed`,
      );
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
            onChange={(event) => {
              setAmount(event.currentTarget.value);
              setMaximumFeeRate(undefined);
            }}
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

function describeDaoError(cause: unknown) {
  if (!(cause instanceof DaoDepositTooSmallError)) return cause;
  return new Error(
    `Minimum deposit is ${ccc.fixedPointToString(cause.minimum)} CKB`,
  );
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
