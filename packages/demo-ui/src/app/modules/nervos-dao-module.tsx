"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

async function findDaoCells(signer: ccc.Signer) {
  const cells: ccc.Cell[] = [];
  const dao = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.NervosDao,
    "0x",
  );
  for await (const cell of signer.findCells(
    { script: dao, scriptLenRange: [33, 34], outputDataLenRange: [8, 9] },
    true,
  )) {
    cells.push(cell);
  }
  return cells;
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
  const deposited = dao.outputData === "0x0000000000000000";
  if (deposited) {
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

export function NervosDaoModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [amount, setAmount] = useState("");
  const [cells, setCells] = useState<ccc.Cell[]>([]);
  const [selectedCell, setSelectedCell] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    findDaoCells(signer)
      .then((next) => {
        if (!cancelled) {
          setCells(next);
          setSelectedCell(cellKey(next[0]));
        }
      })
      .catch(
        (cause) =>
          !cancelled &&
          reportModuleError(cause, show, log, "Unable to load DAO cells"),
      );
    return () => {
      cancelled = true;
    };
  }, [log, show, signer]);

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

  const submit = async (mode: "deposit" | "progress") => {
    if (!signer) return;
    setBusy(true);
    try {
      const cell = cells.find(
        (candidate) => cellKey(candidate) === selectedCell,
      );
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
    } catch (cause) {
      reportModuleError(cause, show, log, `DAO ${mode} failed`);
    } finally {
      setBusy(false);
    }
  };

  const selected = cells.find((cell) => cellKey(cell) === selectedCell);
  const action =
    selected?.outputData === "0x0000000000000000" ? "Redeem" : "Withdraw";

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field">
          <span>Deposit amount / CKB</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>DAO cell</span>
          <select
            value={selectedCell}
            onChange={(event) => setSelectedCell(event.currentTarget.value)}
          >
            <option value="">
              {cells.length ? "Select a DAO cell" : "No DAO cells found"}
            </option>
            {cells.map((cell) => (
              <option key={cellKey(cell)} value={cellKey(cell)}>
                {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB ·{" "}
                {cell.outputData === "0x0000000000000000"
                  ? "deposited"
                  : "withdrawing"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="module-actions">
        <button type="button" disabled={!signer || busy} onClick={maximum}>
          Max
        </button>
        <button
          type="button"
          disabled={!selectedCell || busy}
          onClick={() => submit("progress")}
        >
          {action}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={!signer || !amount || busy}
          onClick={() => submit("deposit")}
        >
          {busy ? "Processing…" : "Deposit"}
        </button>
      </div>
    </div>
  );
}

function cellKey(cell?: ccc.Cell) {
  return cell ? ccc.hexFrom(cell.outPoint.toBytes()) : "";
}
