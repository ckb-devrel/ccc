"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import {
  reportModuleError,
  showTransaction,
  splitLines,
} from "./module-helpers";

type UdtConfig = {
  args: string;
  codeHash: string;
  hashType: string;
  index: string;
  txHash: string;
};

async function transferUdt(
  signer: ccc.Signer,
  config: UdtConfig,
  addresses: string[],
  amount: string,
  onSent: (txHash: string) => void,
) {
  const recipients = await Promise.all(
    addresses.map((address) => ccc.Address.fromString(address, signer.client)),
  );
  const udt = new ccc.udt.Udt(
    { txHash: config.txHash, index: config.index },
    { codeHash: config.codeHash, hashType: config.hashType, args: config.args },
  );
  const { res: tx } = await udt.transfer(
    signer,
    recipients.map(({ script }) => ({ to: script, amount })),
  );
  const completed = await udt.completeBy(tx, signer);
  await completed.completeInputsByCapacity(signer);
  await completed.completeFeeBy(signer);
  const txHash = await signer.sendTransaction(completed);
  onSent(txHash);
  await signer.client.waitTransaction(txHash);
  return txHash;
}

export function TransferUdtModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [destinations, setDestinations] = useState("");
  const [amount, setAmount] = useState("");
  const [config, setConfig] = useState<UdtConfig>({
    args: "",
    codeHash: "",
    hashType: "",
    index: "",
    txHash: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .getKnownScript(ccc.KnownScript.XUdt)
      .then((script) => {
        if (cancelled) return;
        setConfig((current) => ({
          ...current,
          codeHash: script.codeHash,
          hashType: script.hashType,
          txHash: script.cellDeps[0].cellDep.outPoint.txHash,
          index: script.cellDeps[0].cellDep.outPoint.index.toString(),
        }));
      })
      .catch((cause) =>
        reportModuleError(cause, show, log, "Unable to load xUDT script"),
      );
    return () => {
      cancelled = true;
    };
  }, [client, log, show]);

  const transfer = async () => {
    if (!signer) return;
    setBusy(true);
    show({
      label: "ASSEMBLY",
      tone: "pending",
      content: <strong>Building xUDT transfer…</strong>,
    });
    try {
      const txHash = await transferUdt(
        signer,
        config,
        splitLines(destinations),
        amount,
        (hash) => {
          showTransaction(client, show, hash, "xUDT transaction sent");
          log(`Transaction sent: ${hash}`);
        },
      );
      showTransaction(client, show, txHash, "xUDT transaction committed", true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "xUDT transfer failed");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof UdtConfig, label: string) => (
    <label className="module-field">
      <span>{label}</span>
      <input
        value={config[key]}
        spellCheck={false}
        onChange={(event) =>
          setConfig((current) => ({
            ...current,
            [key]: event.currentTarget.value,
          }))
        }
      />
    </label>
  );

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Destination addresses</span>
          <ModuleTextarea
            value={destinations}
            onChange={(event) => setDestinations(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Amount per address</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        {field("args", "UDT args")}
        {field("codeHash", "Code hash")}
        {field("hashType", "Hash type")}
        {field("txHash", "Script code tx hash")}
        {field("index", "Script code index")}
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={
            !signer || busy || !amount || !splitLines(destinations).length
          }
          onClick={transfer}
        >
          {busy ? "Transmitting…" : "Transfer xUDT"}
        </button>
      </div>
    </div>
  );
}
