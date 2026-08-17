"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, splitLines } from "./module-helpers";

type UdtConfig = {
  args: string;
  codeHash: string;
  hashType: string;
  index: string;
  txHash: string;
};

async function loadKnownXUdtConfig(
  client: ccc.Client,
): Promise<Omit<UdtConfig, "args">> {
  const script = await client.getKnownScript(ccc.KnownScript.XUdt);
  const codeCell = script.cellDeps[0].cellDep.outPoint;
  return {
    codeHash: script.codeHash,
    hashType: script.hashType,
    txHash: codeCell.txHash,
    index: codeCell.index.toString(),
  };
}

async function transferUdt(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  config: UdtConfig,
  addresses: string[],
  amount: string,
) {
  const recipients = await Promise.all(
    addresses.map((address) => ccc.Address.fromString(address, signer.client)),
  );
  const udt = new ccc.udt.Udt(
    { txHash: config.txHash, index: config.index },
    { codeHash: config.codeHash, hashType: config.hashType, args: config.args },
  );
  const { res: transfer } = await udt.transfer(
    signer,
    recipients.map(({ script }) => ({ to: script, amount })),
    tx,
  );
  const completed = await udt.completeBy(transfer, signer);
  await completed.completeInputsByCapacity(signer);
  return completed;
}

// -----------------------------------------------------------------------------

export function TransferUdtModule({
  client,
  log,
  show,
  signer,
  submitTransaction,
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
    loadKnownXUdtConfig(client)
      .then((knownConfig) => {
        if (cancelled) return;
        setConfig((current) => ({ ...current, ...knownConfig }));
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
      await submitTransaction("Transfer xUDT", (tx) =>
        transferUdt(signer, tx, config, splitLines(destinations), amount),
      );
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
        onChange={(event) => {
          const { value } = event.currentTarget;
          setConfig((current) => ({
            ...current,
            [key]: value,
          }));
        }}
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
