"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import type { ModuleRuntimeProps } from "../modules";
import {
  reportModuleError,
  showTransaction,
  tokenInfoToBytes,
} from "./module-helpers";

type TokenInfo = {
  amount: string;
  decimals: string;
  name: string;
  symbol: string;
};
type Progress = (txHash: string, message: string) => void;

async function issueWithSingleUseSeal(
  signer: ccc.Signer,
  token: TokenInfo,
  progress: Progress,
) {
  const { script } = await signer.getRecommendedAddressObj();
  const sealTx = ccc.Transaction.from({ outputs: [{ lock: script }] });
  await sealTx.completeInputsByCapacity(signer);
  await sealTx.completeFeeBy(signer);
  const sealHash = await signer.sendTransaction(sealTx);
  progress(sealHash, "Single-use seal created");
  await signer.client.cache.markUnusable({ txHash: sealHash, index: 0 });

  const singleUseLock = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.SingleUseLock,
    ccc.OutPoint.from({ txHash: sealHash, index: 0 }).toBytes(),
  );
  const ownerTx = ccc.Transaction.from({ outputs: [{ lock: singleUseLock }] });
  await ownerTx.completeInputsByCapacity(signer);
  await ownerTx.completeFeeBy(signer);
  const ownerHash = await signer.sendTransaction(ownerTx);
  progress(ownerHash, "Owner cell created");

  const mintTx = ccc.Transaction.from({
    inputs: [
      { previousOutput: { txHash: sealHash, index: 0 } },
      { previousOutput: { txHash: ownerHash, index: 0 } },
    ],
    outputs: [
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.XUdt,
          singleUseLock.hash(),
        ),
      },
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.UniqueType,
          "00".repeat(32),
        ),
      },
    ],
    outputsData: [
      ccc.numLeToBytes(token.amount, 16),
      tokenInfoToBytes(token.decimals, token.symbol, token.name),
    ],
  });
  await mintTx.addCellDepsOfKnownScripts(
    signer.client,
    ccc.KnownScript.SingleUseLock,
    ccc.KnownScript.XUdt,
    ccc.KnownScript.UniqueType,
  );
  await mintTx.completeInputsByCapacity(signer);
  if (!mintTx.outputs[1].type) throw new Error("Token info output disappeared");
  mintTx.outputs[1].type.args = ccc.hexFrom(
    ccc.bytesFrom(ccc.hashTypeId(mintTx.inputs[0], 1)).slice(0, 20),
  );
  await mintTx.completeFeeBy(signer);
  const txHash = await signer.sendTransaction(mintTx);
  progress(txHash, "xUDT mint sent");
  await signer.client.waitTransaction(txHash);
  return txHash;
}

async function issueWithTypeId(
  signer: ccc.Signer,
  token: TokenInfo,
  typeIdArgs: string,
  progress: Progress,
) {
  const { script } = await signer.getRecommendedAddressObj();
  let typeId: ccc.Script;
  if (typeIdArgs) {
    typeId = await ccc.Script.fromKnownScript(
      signer.client,
      ccc.KnownScript.TypeId,
      typeIdArgs,
    );
  } else {
    const typeIdTx = ccc.Transaction.from({
      outputs: [
        {
          lock: script,
          type: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.TypeId,
            "00".repeat(32),
          ),
        },
      ],
    });
    await typeIdTx.completeInputsByCapacity(signer);
    if (!typeIdTx.outputs[0].type)
      throw new Error("Type ID output disappeared");
    typeIdTx.outputs[0].type.args = ccc.hashTypeId(typeIdTx.inputs[0], 0);
    typeId = typeIdTx.outputs[0].type;
    await typeIdTx.completeFeeBy(signer);
    progress(await signer.sendTransaction(typeIdTx), "Type ID created");
  }

  const outputTypeLock = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.OutputTypeProxyLock,
    typeId.hash(),
  );
  const ownerTx = ccc.Transaction.from({ outputs: [{ lock: outputTypeLock }] });
  await ownerTx.completeInputsByCapacity(signer);
  await ownerTx.completeFeeBy(signer);
  const ownerHash = await signer.sendTransaction(ownerTx);
  progress(ownerHash, "Owner cell created");

  const typeIdCell = await signer.client.findSingletonCellByType(typeId);
  if (!typeIdCell) throw new Error("Type ID cell not found");
  const mintTx = ccc.Transaction.from({
    inputs: [
      { previousOutput: typeIdCell.outPoint },
      { previousOutput: { txHash: ownerHash, index: 0 } },
    ],
    outputs: [
      typeIdCell.cellOutput,
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.XUdt,
          outputTypeLock.hash(),
        ),
      },
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.UniqueType,
          "00".repeat(32),
        ),
      },
    ],
    outputsData: [
      typeIdCell.outputData,
      ccc.numLeToBytes(token.amount, 16),
      tokenInfoToBytes(token.decimals, token.symbol, token.name),
    ],
  });
  await mintTx.addCellDepsOfKnownScripts(
    signer.client,
    ccc.KnownScript.OutputTypeProxyLock,
    ccc.KnownScript.XUdt,
    ccc.KnownScript.UniqueType,
  );
  await mintTx.completeInputsByCapacity(signer);
  if (!mintTx.outputs[2].type) throw new Error("Token info output disappeared");
  mintTx.outputs[2].type.args = ccc.hexFrom(
    ccc.bytesFrom(ccc.hashTypeId(mintTx.inputs[0], 2)).slice(0, 20),
  );
  await mintTx.completeFeeBy(signer);
  const txHash = await signer.sendTransaction(mintTx);
  progress(txHash, "xUDT mint sent");
  await signer.client.waitTransaction(txHash);
  return txHash;
}

export function IssueXUdtSusModule(props: ModuleRuntimeProps) {
  return <IssueXUdtModule {...props} mode="sus" />;
}

export function IssueXUdtTypeIdModule(props: ModuleRuntimeProps) {
  return <IssueXUdtModule {...props} mode="typeId" />;
}

function IssueXUdtModule({
  client,
  log,
  mode,
  show,
  signer,
}: ModuleRuntimeProps & { mode: "sus" | "typeId" }) {
  const [token, setToken] = useState<TokenInfo>({
    amount: "",
    decimals: "",
    name: "",
    symbol: "",
  });
  const [typeIdArgs, setTypeIdArgs] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof TokenInfo, value: string) =>
    setToken((current) => ({ ...current, [key]: value }));

  const issue = async () => {
    if (!signer) return;
    if (!token.decimals || !token.symbol || !token.amount) {
      reportModuleError(
        new Error("Amount, decimals and symbol are required"),
        show,
        log,
      );
      return;
    }
    setBusy(true);
    const progress: Progress = (hash, message) => {
      showTransaction(client, show, hash, message);
      log(`${message}: ${hash}`);
    };
    try {
      const txHash =
        mode === "sus"
          ? await issueWithSingleUseSeal(signer, token, progress)
          : await issueWithTypeId(signer, token, typeIdArgs, progress);
      showTransaction(client, show, txHash, "xUDT issued", true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "xUDT issue failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        {mode === "typeId" ? (
          <label className="module-field module-field-wide">
            <span>Type ID args / optional</span>
            <input
              value={typeIdArgs}
              onChange={(event) => setTypeIdArgs(event.currentTarget.value)}
            />
          </label>
        ) : null}
        <label className="module-field">
          <span>Amount</span>
          <input
            value={token.amount}
            onChange={(event) => update("amount", event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Decimals</span>
          <input
            value={token.decimals}
            onChange={(event) => update("decimals", event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Symbol</span>
          <input
            value={token.symbol}
            onChange={(event) => update("symbol", event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Name / optional</span>
          <input
            value={token.name}
            onChange={(event) => update("name", event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy}
          onClick={issue}
        >
          {busy ? "Issuing…" : "Issue xUDT"}
        </button>
      </div>
    </div>
  );
}
