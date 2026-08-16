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

function validateTokenInfo(token: TokenInfo) {
  if (!token.amount || !token.decimals || !token.symbol) {
    throw new Error("Amount, decimals and symbol are required");
  }
  return token;
}

async function issueWithSingleUseSeal(
  signer: ccc.Signer,
  token: TokenInfo,
  progress: Progress,
  submitTransaction: ModuleRuntimeProps["submitTransaction"],
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

  await submitTransaction("Issue xUDT with single-use seal", async (tx) => {
    const sealInputIndex = tx.inputs.length;
    tx.addInput({ previousOutput: { txHash: sealHash, index: 0 } });
    tx.addInput({ previousOutput: { txHash: ownerHash, index: 0 } });
    tx.addOutput(
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.XUdt,
          singleUseLock.hash(),
        ),
      },
      ccc.numLeToBytes(token.amount, 16),
    );
    const infoOutputIndex = tx.outputs.length;
    tx.addOutput(
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.UniqueType,
          "00".repeat(32),
        ),
      },
      tokenInfoToBytes(token.decimals, token.symbol, token.name),
    );
    await tx.addCellDepsOfKnownScripts(
      signer.client,
      ccc.KnownScript.SingleUseLock,
      ccc.KnownScript.XUdt,
      ccc.KnownScript.UniqueType,
    );
    const infoType = tx.outputs[infoOutputIndex].type;
    if (!infoType) throw new Error("Token info output disappeared");
    infoType.args = ccc.hexFrom(
      ccc
        .bytesFrom(ccc.hashTypeId(tx.inputs[sealInputIndex], infoOutputIndex))
        .slice(0, 20),
    );
    return tx;
  });
}

async function issueWithTypeId(
  signer: ccc.Signer,
  token: TokenInfo,
  typeIdArgs: string,
  progress: Progress,
  submitTransaction: ModuleRuntimeProps["submitTransaction"],
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
  await submitTransaction("Issue xUDT with Type ID", async (tx) => {
    const typeIdInputIndex = tx.inputs.length;
    tx.addInput(typeIdCell);
    tx.addInput({ previousOutput: { txHash: ownerHash, index: 0 } });
    tx.addOutput(typeIdCell.cellOutput, typeIdCell.outputData);
    tx.addOutput(
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.XUdt,
          outputTypeLock.hash(),
        ),
      },
      ccc.numLeToBytes(token.amount, 16),
    );
    const infoOutputIndex = tx.outputs.length;
    tx.addOutput(
      {
        lock: script,
        type: await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.UniqueType,
          "00".repeat(32),
        ),
      },
      tokenInfoToBytes(token.decimals, token.symbol, token.name),
    );
    await tx.addCellDepsOfKnownScripts(
      signer.client,
      ccc.KnownScript.OutputTypeProxyLock,
      ccc.KnownScript.XUdt,
      ccc.KnownScript.UniqueType,
    );
    const infoType = tx.outputs[infoOutputIndex].type;
    if (!infoType) throw new Error("Token info output disappeared");
    infoType.args = ccc.hexFrom(
      ccc
        .bytesFrom(ccc.hashTypeId(tx.inputs[typeIdInputIndex], infoOutputIndex))
        .slice(0, 20),
    );
    return tx;
  });
}

// -----------------------------------------------------------------------------

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
  submitTransaction,
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
    let validToken: TokenInfo;
    try {
      validToken = validateTokenInfo(token);
    } catch (cause) {
      reportModuleError(cause, show, log);
      return;
    }
    setBusy(true);
    const progress: Progress = (hash, message) => {
      showTransaction(client, show, hash, message);
      log(`${message}: ${hash}`);
    };
    try {
      if (mode === "sus") {
        await issueWithSingleUseSeal(
          signer,
          validToken,
          progress,
          submitTransaction,
        );
      } else {
        await issueWithTypeId(
          signer,
          validToken,
          typeIdArgs,
          progress,
          submitTransaction,
        );
      }
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
