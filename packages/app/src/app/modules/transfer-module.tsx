"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { bytesFromAnyString, splitLines } from "./module-helpers";

class TransferCapacityError extends Error {
  constructor(
    readonly outputIndex: number,
    readonly minimum: ccc.Num,
  ) {
    super("Transfer amount is below the minimum cell capacity");
  }
}

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

  const feeRate = await signer.client.getFeeRate();
  await tx.completeInputsAll(signer);
  await tx.completeFeeChangeToOutput(signer, 0, feeRate);

  return { capacity: tx.outputs[0].capacity, feeRate };
}

async function buildTransfer({
  amount,
  data,
  destinations,
  signer,
  tx,
}: {
  amount: string;
  data: string;
  destinations: string[];
  signer: ccc.Signer;
  tx: ccc.Transaction;
}) {
  const capacity = ccc.fixedPointFrom(amount);
  const recipients = await Promise.all(
    destinations.map((address) =>
      ccc.Address.fromString(address, signer.client),
    ),
  );
  recipients.forEach(({ script }, index) => {
    const outputData = index === 0 ? bytesFromAnyString(data) : "0x";
    const minimum = ccc.CellOutput.from({ lock: script }, outputData).capacity;
    if (capacity < minimum) {
      throw new TransferCapacityError(index, minimum);
    }
    tx.addOutput({ capacity, lock: script }, outputData);
  });
  return tx;
}

// -----------------------------------------------------------------------------

type TransferState = {
  kind: "error" | "idle" | "pending" | "success";
  message: string;
};

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

export function TransferModule({
  log,
  show,
  signer,
  submitTransaction,
}: ModuleRuntimeProps) {
  const [destinations, setDestinations] = useState("");
  const [amount, setAmount] = useState("");
  const [maximumFeeRate, setMaximumFeeRate] = useState<ccc.Num>();
  const [data, setData] = useState("");
  const [busy, setBusy] = useState<"max" | "transfer">();
  const addresses = parseDestinationAddresses(destinations);
  const disabled = signer === undefined || busy !== undefined;

  const updateReadout = ({ kind, message }: TransferState) => {
    show({
      label: kind,
      tone: kind,
      content: <strong>{message}</strong>,
    });
  };

  const calculateMax = async () => {
    setMaximumFeeRate(undefined);
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
      const result = await calculateMaximumTransfer(signer, destination, data);
      const maximum = ccc.fixedPointToString(result.capacity);
      setAmount(maximum);
      setMaximumFeeRate(result.feeRate);
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
      await submitTransaction(
        "Transfer CKB",
        (tx) =>
          buildTransfer({
            amount,
            data,
            destinations: validDestinations,
            signer,
            tx,
          }),
        { feeRate: maximumFeeRate },
      );
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
            onChange={(event) => {
              setAmount(event.currentTarget.value);
              setMaximumFeeRate(undefined);
            }}
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
  if (cause instanceof TransferCapacityError) {
    return `Minimum for output ${cause.outputIndex} is ${ccc.fixedPointToString(cause.minimum)} CKB`;
  }
  return cause instanceof Error ? cause.message : "Transaction failed";
}
