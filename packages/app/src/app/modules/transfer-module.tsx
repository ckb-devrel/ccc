"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { explorerLink } from "../explorer-link";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { bytesFromAnyString, splitLines } from "./module-helpers";

type TransferState = {
  kind: "error" | "idle" | "pending" | "success";
  message: string;
  txHash?: string;
};

async function calculateMaximumTransfer(
  signer: ccc.Signer,
  destination: string,
  data: string,
) {
  const { script: lock } = await ccc.Address.fromString(
    destination,
    signer.client,
  );
  const tx = ccc.Transaction.from({
    outputs: [{ lock }],
    outputsData: [bytesFromAnyString(data)],
  });

  await tx.completeInputsAll(signer);
  await tx.completeFeeChangeToOutput(signer, 0);

  return ccc.fixedPointToString(tx.outputs[0].capacity);
}

async function sendTransfer({
  amount,
  data,
  destinations,
  onSent,
  signer,
}: {
  amount: string;
  data: string;
  destinations: string[];
  onSent: (txHash: string) => void;
  signer: ccc.Signer;
}) {
  const capacity = ccc.fixedPointFrom(amount);
  const recipients = await Promise.all(
    destinations.map((address) =>
      ccc.Address.fromString(address, signer.client),
    ),
  );
  const tx = ccc.Transaction.from({
    outputs: recipients.map(({ script }) => ({ capacity, lock: script })),
    outputsData: recipients.map((_, index) =>
      index === 0 ? bytesFromAnyString(data) : "0x",
    ),
  });

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);

  const txHash = await signer.sendTransaction(tx);
  onSent(txHash);
  await signer.client.waitTransaction(txHash);

  return txHash;
}

function parseDestinationAddresses(value: string) {
  return splitLines(value);
}

function requireSingleDestination(addresses: string[]) {
  if (addresses.length !== 1) {
    throw new Error("Max amount requires exactly one destination");
  }
  return addresses[0];
}

function requireDestinations(addresses: string[]) {
  if (addresses.length === 0) {
    throw new Error("Enter at least one destination");
  }
  return addresses;
}

// -----------------------------------------------------------------------------

export function TransferModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [destinations, setDestinations] = useState("");
  const [amount, setAmount] = useState("");
  const [data, setData] = useState("");
  const [busy, setBusy] = useState<"max" | "transfer">();
  const addresses = parseDestinationAddresses(destinations);
  const disabled = signer === undefined || busy !== undefined;

  const updateReadout = ({ kind, message, txHash }: TransferState) => {
    show({
      label: kind,
      tone: kind,
      content: txHash ? (
        explorerLink(
          client,
          "transaction",
          txHash,
          <>
            <span>{message}</span>
            <code>{shortHash(txHash)}</code>
          </>,
        )
      ) : (
        <strong>{message}</strong>
      ),
    });
  };

  const calculateMax = async () => {
    if (!signer) {
      updateReadout({ kind: "error", message: "Connect a signer first" });
      return;
    }
    let destination: string;
    try {
      destination = requireSingleDestination(addresses);
    } catch (cause) {
      updateReadout({ kind: "error", message: errorMessage(cause) });
      return;
    }
    setBusy("max");
    updateReadout({
      kind: "pending",
      message: "Calculating available capacity…",
    });
    log("Calculating maximum transferable capacity");
    try {
      const maximum = await calculateMaximumTransfer(signer, destination, data);
      setAmount(maximum);
      updateReadout({
        kind: "success",
        message: `Maximum: ${maximum} CKB`,
      });
      log(`Maximum available: ${maximum} CKB`, "success");
    } catch (cause) {
      const error = errorMessage(cause);
      updateReadout({ kind: "error", message: error });
      log(error, "error");
    } finally {
      setBusy(undefined);
    }
  };

  const transfer = async () => {
    if (!signer) {
      updateReadout({ kind: "error", message: "Connect a signer first" });
      return;
    }
    let validDestinations: string[];
    try {
      validDestinations = requireDestinations(addresses);
    } catch (cause) {
      updateReadout({ kind: "error", message: errorMessage(cause) });
      return;
    }
    setBusy("transfer");
    updateReadout({ kind: "pending", message: "Assembling transaction…" });
    log(`Assembling transfer to ${addresses.length} destination(s)`);
    try {
      updateReadout({
        kind: "pending",
        message: "Awaiting wallet approval…",
      });
      const txHash = await sendTransfer({
        amount,
        data,
        destinations: validDestinations,
        signer,
        onSent: (txHash) => {
          updateReadout({
            kind: "pending",
            message: "Transaction sent; confirming…",
            txHash,
          });
          log(`Transaction sent: ${txHash}`);
        },
      });
      updateReadout({
        kind: "success",
        message: "Transaction committed",
        txHash,
      });
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      const error = errorMessage(cause);
      updateReadout({ kind: "error", message: error });
      log(error, "error");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="module-console transfer-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Destination addresses</span>
          <ModuleTextarea
            value={destinations}
            placeholder="One CKB address per line"
            spellCheck={false}
            onChange={(event) => setDestinations(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Amount per address / CKB</span>
          <input
            value={amount}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Output data / optional</span>
          <input
            value={data}
            placeholder="UTF-8 or 0x-prefixed hex"
            spellCheck={false}
            onChange={(event) => setData(event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="module-actions">
        <button type="button" disabled={disabled} onClick={calculateMax}>
          {busy === "max" ? "Calculating…" : "Max amount"}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={disabled || amount.trim() === ""}
          onClick={transfer}
        >
          {busy === "transfer" ? "Transmitting…" : "Transfer"}
        </button>
      </div>
    </div>
  );
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Transaction failed";
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
