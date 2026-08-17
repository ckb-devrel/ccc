"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { generateDefaultScriptInfos } from "@ckb-ccc/lumos-patches";
import { Indexer } from "@ckb-lumos/ckb-indexer";
import common, {
  registerCustomLockScriptInfos,
} from "@ckb-lumos/common-scripts/lib/common";
import { predefined } from "@ckb-lumos/config-manager";
import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import {
  bytesFromAnyString,
  reportModuleError,
  showTransaction,
} from "./module-helpers";

async function composeWithLumos(
  signer: ccc.Signer,
  destination: string,
  amount: string,
  data: string,
) {
  await ccc.Address.fromString(destination, signer.client);
  const fromAddresses = await signer.getAddresses();
  const config =
    signer.client.addressPrefix === "ckb"
      ? predefined.LINA
      : predefined.AGGRON4;
  const indexer = new Indexer(
    signer.client.url
      .replace("wss://", "https://")
      .replace("ws://", "http://")
      .replace(/\/ws\/?$/, "/"),
  );

  registerCustomLockScriptInfos(generateDefaultScriptInfos());
  let skeleton = new TransactionSkeleton({ cellProvider: indexer });
  skeleton = await common.transfer(
    skeleton,
    fromAddresses,
    destination,
    ccc.fixedPointFrom(amount),
    undefined,
    undefined,
    { config },
  );
  skeleton = await common.payFeeByFeeRate(
    skeleton,
    fromAddresses,
    await signer.client.getFeeRate(),
    undefined,
    { config },
  );
  const tx = ccc.Transaction.fromLumosSkeleton(skeleton);
  const dataBytes = bytesFromAnyString(data);
  if (tx.outputs[0].capacity < ccc.fixedPointFrom(dataBytes.length)) {
    throw new Error("Insufficient capacity to store output data");
  }
  tx.outputsData[0] = ccc.hexFrom(dataBytes);
  return tx;
}

// -----------------------------------------------------------------------------

export function TransferLumosModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [data, setData] = useState("");
  const [busy, setBusy] = useState(false);

  const transfer = async () => {
    if (!signer) return;
    setBusy(true);
    show({
      label: "LUMOS",
      tone: "pending",
      content: <strong>Composing transaction skeleton…</strong>,
    });
    try {
      const tx = await composeWithLumos(signer, destination, amount, data);
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, "Transfer with Lumos sent");
      log(`Transfer with Lumos sent: ${txHash}`);
    } catch (cause) {
      reportModuleError(cause, show, log, "Lumos transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field">
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
            inputMode="decimal"
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Output data / optional</span>
          <ModuleTextarea
            value={data}
            onChange={(event) => setData(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy || !destination || !amount}
          onClick={transfer}
        >
          {busy ? "Composing…" : "Transfer with Lumos"}
        </button>
      </div>
    </div>
  );
}
